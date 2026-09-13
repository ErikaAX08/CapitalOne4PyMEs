package kernel

import "fmt"

// Company is the engine's view of the data model: a projection of `companies`,
// `company_snapshots` and `recurring_rules` at a cut-off date
// (docs/data-model.md §4). Its field set is exactly the `company` block of
// contracts/engine-request.schema.json.
//
// An unknown value is a nil pointer, never zero. That distinction is what the
// coverage rule reads: a nil counts against coverage and can force an
// abstention, whereas a zero would be a silent, confident lie.
type Company struct {
	CompanyID                 string          `json:"company_id"`
	Currency                  string          `json:"currency,omitempty"`
	OpeningBalanceCents       *int64          `json:"opening_balance_cents"`
	PayrollCents              *int64          `json:"payroll_cents"`
	PayrollIntervalDays       *int            `json:"payroll_interval_days"`
	MainCustomerConcentration *float64        `json:"main_customer_concentration"`
	ContractedTermDays        *int            `json:"contracted_term_days"`
	AverageCollectionDays     *int            `json:"average_collection_days"`
	ProjectDeliveryDay        int             `json:"project_delivery_day"`
	HireMonthlyCostCents      int64           `json:"hire_monthly_cost_cents"`
	RecurringRules            []RecurringRule `json:"recurring_rules"`
	OneOffMovements           []Movement      `json:"one_off_movements,omitempty"`
}

// RecurringRule is a movement repeated every IntervalDays from FirstDay, the
// base calendar of the current operation before any decision is applied.
type RecurringRule struct {
	ID           string `json:"id"`
	Node         string `json:"node"`
	Direction    string `json:"direction"`
	AmountCents  int64  `json:"amount_cents"`
	FirstDay     int    `json:"first_day"`
	IntervalDays int    `json:"interval_days"`
	Shift        string `json:"shift,omitempty"`
	Scale        string `json:"scale,omitempty"`
	Exposure     string `json:"exposure,omitempty"`
	Provenance   string `json:"provenance,omitempty"`
}

// Movement is one dated receipt or obligation that no rule generated.
type Movement struct {
	ID           string `json:"id"`
	Node         string `json:"node"`
	Direction    string `json:"direction"`
	Day          int    `json:"day"`
	AmountCents  int64  `json:"amount_cents"`
	Shift        string `json:"shift,omitempty"`
	Scale        string `json:"scale,omitempty"`
	Exposure     string `json:"exposure,omitempty"`
	Priority     *int   `json:"priority,omitempty"`
	KnownAt      *int   `json:"known_at,omitempty"`
	SettledCents *int64 `json:"settled_cents,omitempty"`
	Provenance   string `json:"provenance,omitempty"`
}

// coverageVariables are the profile variables coverage is measured over. The
// list mirrors engine/cash/profile.py:COVERAGE_VARIABLES; the seven of
// docs/data-model.md §4.
func (c Company) coverageVariables() []bool {
	return []bool{
		c.OpeningBalanceCents != nil,
		c.PayrollCents != nil,
		c.PayrollIntervalDays != nil,
		c.MainCustomerConcentration != nil,
		c.ContractedTermDays != nil,
		c.AverageCollectionDays != nil,
		c.RecurringRules != nil,
	}
}

// Coverage reports how many of the profile variables are known.
func (c Company) Coverage() (known, total int) {
	vars := c.coverageVariables()
	for _, ok := range vars {
		if ok {
			known++
		}
	}
	return known, len(vars)
}

// Validate rejects a profile that could not have come from the data model.
func (c Company) Validate() error {
	if c.CompanyID == "" {
		return fmt.Errorf("company_id is required")
	}
	if c.Currency != "" && c.Currency != "MXN" {
		return fmt.Errorf("currency: only MXN is supported, got %q", c.Currency)
	}
	for _, r := range c.RecurringRules {
		if r.IntervalDays <= 0 {
			return fmt.Errorf("recurring rule %s has a non-positive interval", r.ID)
		}
		if r.Direction != "in" && r.Direction != "out" {
			return fmt.Errorf("recurring rule %s has direction %q, want in or out", r.ID, r.Direction)
		}
		if r.FirstDay < 0 {
			return fmt.Errorf("recurring rule %s predates the cut-off", r.ID)
		}
	}
	for _, m := range c.OneOffMovements {
		if m.Day < 0 {
			return fmt.Errorf("movement %s predates the cut-off", m.ID)
		}
	}
	return nil
}
