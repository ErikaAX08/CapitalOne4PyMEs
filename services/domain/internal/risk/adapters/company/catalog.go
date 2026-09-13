package company

import (
	"context"
	"fmt"
	"strings"
)

// Summary is one row of the company catalogue: enough for a person to choose a
// company, and enough to tell them in advance what the analysis will do with it.
type Summary struct {
	CompanyID string `json:"companyId"`
	Name      string `json:"name"`
	Vertical  string `json:"vertical"`
	Dataset   string `json:"dataset,omitempty"`
	Known     int    `json:"knownVariables"`
	Total     int    `json:"totalVariables"`
	// Missing names the profile variables the caller must declare before the
	// analysis can answer. Listing them is what turns an abstention from a dead
	// end into an instruction.
	Missing []string `json:"missing,omitempty"`
	// Bankrupt reports whether the reference set observed this company failing.
	// It is a recorded outcome, never a prediction.
	Bankrupt     bool   `json:"bankrupt"`
	BalanceCents *int64 `json:"openingBalanceCents,omitempty"`
}

// CatalogQuery narrows a listing.
type CatalogQuery struct {
	Search string
	Limit  int
	Offset int
	// OnlyBankrupt and OnlySurvivors are mutually exclusive; both false lists
	// every company.
	OnlyBankrupt  bool
	OnlySurvivors bool
}

const catalogDefaultLimit = 50
const catalogMaxLimit = 200

// Catalog lists the companies available to analyse.
//
// The demo company leads the list when the fallback repository serves one. Its
// profile is a fixture, not a row, so it is described from the fixture rather
// than mirrored into `company_snapshots`: a copy would be one more thing that
// can drift from the file the product actually reads. It is also the only
// company that arrives fully described, which is what makes it the sensible
// default for someone who just wants to run a simulation.
func (r *PostgresRepository) Catalog(ctx context.Context, q CatalogQuery) ([]Summary, error) {
	stored, err := r.storedCatalog(ctx, q)
	if err != nil {
		return nil, err
	}
	demo := r.demoSummary(ctx, q)
	if demo == nil {
		return stored, nil
	}
	return append([]Summary{*demo}, stored...), nil
}

// demoSummary describes the fallback company, or nil when it does not belong in
// this listing: it has no recorded outcome, so a search for bankrupt companies
// excludes it, and a name search must actually match it.
func (r *PostgresRepository) demoSummary(ctx context.Context, q CatalogQuery) *Summary {
	if r.fallbck == nil || q.OnlyBankrupt || q.Offset > 0 {
		return nil
	}
	profile, err := r.fallbck.Profile(ctx, r.fallbck.DefaultCompanyID())
	if err != nil {
		return nil
	}
	// The fixture carries no name -- it is the engine's request shape, not a
	// directory entry -- so the readable one comes from `companies` if a row is
	// there. Falling back to the identifier is ugly but never wrong.
	name := profile.CompanyID
	if err := r.pool.QueryRow(ctx,
		`SELECT name FROM companies WHERE company_id = $1`, profile.CompanyID,
	).Scan(&name); err != nil {
		name = profile.CompanyID
	}
	if q.Search != "" && !strings.Contains(strings.ToLower(name), strings.ToLower(q.Search)) {
		return nil
	}
	known, total := profile.Coverage()
	summary := Summary{
		CompanyID: profile.CompanyID,
		Name:      name,
		Vertical:  "demo",
		Known:     known,
		Total:     total,
	}
	if profile.OpeningBalanceCents != nil {
		balance := *profile.OpeningBalanceCents
		summary.BalanceCents = &balance
	}
	// Only the variables a caller can supply are listed.
	for name, known := range map[string]bool{
		"opening_balance_cents":       profile.OpeningBalanceCents != nil,
		"payroll_cents":               profile.PayrollCents != nil,
		"main_customer_concentration": profile.MainCustomerConcentration != nil,
		"contracted_term_days":        profile.ContractedTermDays != nil,
		"average_collection_days":     profile.AverageCollectionDays != nil,
	} {
		if !known {
			summary.Missing = append(summary.Missing, name)
		}
	}
	sortStrings(summary.Missing)
	return &summary
}

func (r *PostgresRepository) storedCatalog(ctx context.Context, q CatalogQuery) ([]Summary, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = catalogDefaultLimit
	}
	if limit > catalogMaxLimit {
		limit = catalogMaxLimit
	}

	where := []string{"s.cutoff_date <= $1"}
	args := []any{r.cutoff.ISO()}
	if q.Search != "" {
		args = append(args, "%"+strings.ToLower(q.Search)+"%")
		where = append(where, fmt.Sprintf("lower(c.name) LIKE $%d", len(args)))
	}
	if q.OnlyBankrupt {
		where = append(where, "o.event_id IS NOT NULL")
	}
	if q.OnlySurvivors {
		where = append(where, "o.event_id IS NULL")
	}
	args = append(args, limit, q.Offset)

	rows, err := r.pool.Query(ctx, `
		SELECT rtrim(c.company_id), c.name, c.vertical, coalesce(s.dataset, ''),
		       s.known_variables, s.total_variables,
		       s.opening_balance_cents, s.payroll_cents,
		       s.main_customer_concentration, s.contracted_term_days,
		       s.average_collection_days,
		       (o.event_id IS NOT NULL)
		FROM companies c
		JOIN company_snapshots s ON s.company_id = c.company_id
		LEFT JOIN LATERAL (
			SELECT event_id FROM outcome_events e
			WHERE e.company_id = c.company_id AND e.kind = 'bankruptcy' LIMIT 1
		) o ON true
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY c.name
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)),
		args...)
	if err != nil {
		return nil, fmt.Errorf("listing companies: %w", err)
	}
	defer rows.Close()

	summaries := []Summary{}
	for rows.Next() {
		var (
			s              Summary
			balance        *int64
			payroll        *int64
			concentration  *float64
			contractedTerm *int
			collection     *int
		)
		if err := rows.Scan(
			&s.CompanyID, &s.Name, &s.Vertical, &s.Dataset,
			&s.Known, &s.Total, &balance, &payroll,
			&concentration, &contractedTerm, &collection, &s.Bankrupt,
		); err != nil {
			return nil, fmt.Errorf("reading a company: %w", err)
		}
		s.BalanceCents = balance
		// Only the variables a caller can supply are listed; the recurring
		// calendar is not one of them.
		for name, known := range map[string]bool{
			"opening_balance_cents":       balance != nil,
			"payroll_cents":               payroll != nil,
			"main_customer_concentration": concentration != nil,
			"contracted_term_days":        contractedTerm != nil,
			"average_collection_days":     collection != nil,
		} {
			if !known {
				s.Missing = append(s.Missing, name)
			}
		}
		sortStrings(s.Missing)
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// sortStrings keeps the missing list in a stable order, so the same company
// always reports it the same way.
func sortStrings(values []string) {
	for i := 1; i < len(values); i++ {
		for j := i; j > 0 && values[j] < values[j-1]; j-- {
			values[j], values[j-1] = values[j-1], values[j]
		}
	}
}
