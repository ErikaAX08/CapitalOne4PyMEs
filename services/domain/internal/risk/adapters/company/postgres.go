package company

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// ErrNotFound is returned when no such company exists. It is deliberately
// distinct from a failure to reach the database: "this company does not exist"
// and "the database did not answer" are different answers, and conflating them
// would tell a caller to stop asking about a company that is perfectly real.
var ErrNotFound = errors.New("unknown company")

// PostgresRepository serves a company profile from the database: the projection
// of `companies`, `company_snapshots` and `movements` that docs/data-model.md §4
// defines. It implements the same port as FixtureRepository, so nothing above
// it changes when one replaces the other.
//
// An unknown variable stays a nil pointer all the way through. That is what
// lets the coverage rule see it: a profile assembled here can and often does
// abstain, which is the correct answer rather than a failure.
type PostgresRepository struct {
	pool    *pgxpool.Pool
	cutoff  kernel.CutoffDate
	fallbck *FixtureRepository
}

// NewPostgresRepository wires a repository over an existing pool.
//
// `fallback` serves the demo company, whose profile is a fixture rather than a
// row: it is the one company the product ships with, and it must keep working
// whether or not the database holds anything. Pass nil for none.
func NewPostgresRepository(pool *pgxpool.Pool, cutoff kernel.CutoffDate, fallback *FixtureRepository) *PostgresRepository {
	return &PostgresRepository{pool: pool, cutoff: cutoff, fallbck: fallback}
}

// Profile assembles the company the analysis runs on.
func (r *PostgresRepository) Profile(ctx context.Context, companyID string) (kernel.Company, error) {
	if r.fallbck != nil && (companyID == "" || companyID == r.fallbck.DefaultCompanyID()) {
		return r.fallbck.Profile(ctx, companyID)
	}

	profile, cutoff, err := r.snapshot(ctx, companyID)
	if err != nil {
		return kernel.Company{}, err
	}

	rules, err := r.recurringRules(ctx, companyID, cutoff)
	if err != nil {
		return kernel.Company{}, err
	}
	profile.RecurringRules = rules

	movements, err := r.oneOffMovements(ctx, companyID, cutoff)
	if err != nil {
		return kernel.Company{}, err
	}
	profile.OneOffMovements = movements

	return profile, profile.Validate()
}

// snapshot reads the company and its most recent snapshot at or before the
// cut-off. Every nullable column stays nil when the database holds NULL.
func (r *PostgresRepository) snapshot(ctx context.Context, companyID string) (kernel.Company, kernel.CutoffDate, error) {
	var (
		profile  kernel.Company
		cutoffAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		SELECT rtrim(c.company_id), c.currency, c.payroll_interval_days,
		       c.project_delivery_day, c.hire_monthly_cost_cents,
		       s.cutoff_date, s.opening_balance_cents, s.payroll_cents,
		       s.main_customer_concentration, s.contracted_term_days,
		       s.average_collection_days
		FROM companies c
		JOIN company_snapshots s ON s.company_id = c.company_id
		WHERE c.company_id = $1 AND s.cutoff_date <= $2
		ORDER BY s.cutoff_date DESC
		LIMIT 1`,
		companyID, r.cutoff.ISO(),
	).Scan(
		&profile.CompanyID, &profile.Currency, &profile.PayrollIntervalDays,
		&profile.ProjectDeliveryDay, &profile.HireMonthlyCostCents,
		&cutoffAt, &profile.OpeningBalanceCents, &profile.PayrollCents,
		&profile.MainCustomerConcentration, &profile.ContractedTermDays,
		&profile.AverageCollectionDays,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return kernel.Company{}, kernel.CutoffDate{},
			fmt.Errorf("%w: %s", ErrNotFound, companyID)
	}
	if err != nil {
		return kernel.Company{}, kernel.CutoffDate{},
			fmt.Errorf("reading the company profile: %w", err)
	}
	return profile, kernel.NewCutoffDate(cutoffAt), nil
}

// recurringRules reads the base calendar valid at the cut-off.
//
// `first_day` is the rule's first due date expressed as a day offset, and the
// engine refuses a negative one, so a rule whose first date is already past is
// advanced by whole intervals to its next occurrence. That is arithmetic on the
// rule the database holds, not a new rule.
func (r *PostgresRepository) recurringRules(ctx context.Context, companyID string, cutoff kernel.CutoffDate) ([]kernel.RecurringRule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT rtrim(rule_id), node, direction, amount_cents, first_due_date,
		       interval_days, shift, scale, exposure, provenance
		FROM recurring_rules
		WHERE company_id = $1
		  AND valid_from <= $2
		  AND (valid_to IS NULL OR valid_to >= $2)
		ORDER BY first_due_date`,
		companyID, cutoff.ISO())
	if err != nil {
		return nil, fmt.Errorf("reading the recurring rules: %w", err)
	}
	defer rows.Close()

	rules := []kernel.RecurringRule{}
	for rows.Next() {
		var (
			rule  kernel.RecurringRule
			first time.Time
		)
		if err := rows.Scan(
			&rule.ID, &rule.Node, &rule.Direction, &rule.AmountCents, &first,
			&rule.IntervalDays, &rule.Shift, &rule.Scale, &rule.Exposure, &rule.Provenance,
		); err != nil {
			return nil, fmt.Errorf("reading a recurring rule: %w", err)
		}
		rule.FirstDay = daysBetween(cutoff, first)
		for rule.FirstDay < 0 && rule.IntervalDays > 0 {
			rule.FirstDay += rule.IntervalDays
		}
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

// oneOffMovements reads the dated obligations and receipts no rule generated,
// exactly as docs/data-model.md §4 specifies: open, not rule-generated, and
// knowable at the cut-off.
func (r *PostgresRepository) oneOffMovements(ctx context.Context, companyID string, cutoff kernel.CutoffDate) ([]kernel.Movement, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT rtrim(movement_id), node, direction, due_date, amount_cents,
		       shift, scale, exposure, priority, settled_cents, provenance
		FROM movements
		WHERE company_id = $1
		  AND rule_id IS NULL
		  AND status NOT IN ('settled', 'cancelled')
		  AND known_at <= $2
		  AND due_date >= $2
		ORDER BY due_date`,
		companyID, cutoff.ISO())
	if err != nil {
		return nil, fmt.Errorf("reading the movements: %w", err)
	}
	defer rows.Close()

	movements := []kernel.Movement{}
	for rows.Next() {
		var (
			movement kernel.Movement
			due      time.Time
			settled  int64
		)
		if err := rows.Scan(
			&movement.ID, &movement.Node, &movement.Direction, &due,
			&movement.AmountCents, &movement.Shift, &movement.Scale,
			&movement.Exposure, &movement.Priority, &settled, &movement.Provenance,
		); err != nil {
			return nil, fmt.Errorf("reading a movement: %w", err)
		}
		movement.Day = daysBetween(cutoff, due)
		if settled > 0 {
			movement.SettledCents = &settled
		}
		movements = append(movements, movement)
	}
	return movements, rows.Err()
}

// daysBetween is the engine's day offset of a calendar date from the cut-off.
func daysBetween(cutoff kernel.CutoffDate, date time.Time) int {
	from, _ := time.Parse(time.DateOnly, cutoff.ISO())
	to := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	return int(to.Sub(from).Hours() / 24)
}
