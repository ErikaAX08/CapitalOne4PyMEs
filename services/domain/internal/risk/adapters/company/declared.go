package company

import (
	"fmt"
	"strconv"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Declared carries the profile variables the caller supplies for this run.
//
// The product's own flow is that the person simulating types their numbers, and
// a reference company stored without them cannot be analysed until they do:
// three of the seven coverage variables are absent from the historical set
// (docs/data-model.md §6), which is 43% unknown against a 20% threshold.
//
// A declared value only ever fills a hole. It never overwrites something the
// database knows, because a figure someone typed is weaker evidence than a
// figure that was recorded — and silently replacing the second with the first
// would make the stored profile unreachable.
type Declared struct {
	PayrollCents              *int64
	PayrollIntervalDays       *int
	MainCustomerConcentration *float64
	ContractedTermDays        *int
	AverageCollectionDays     *int
	OpeningBalanceCents       *int64
}

// Query is the subset of a URL query the declared parameters are read from. It
// matches the port the scenario builder already uses.
type Query interface {
	Get(id string) (string, bool)
}

// ParseDeclared reads the optional profile parameters. An absent one stays nil;
// a malformed one is an error rather than a silent default, because a typo that
// degrades into an unknown would abstain without saying why.
func ParseDeclared(q Query) (Declared, error) {
	var d Declared
	var err error

	if d.PayrollCents, err = optionalCents(q, "payroll_cents"); err != nil {
		return Declared{}, err
	}
	if d.OpeningBalanceCents, err = optionalCents(q, "opening_balance_cents"); err != nil {
		return Declared{}, err
	}
	if d.PayrollIntervalDays, err = optionalDays(q, "payroll_interval_days"); err != nil {
		return Declared{}, err
	}
	if d.ContractedTermDays, err = optionalDays(q, "contracted_term_days"); err != nil {
		return Declared{}, err
	}
	if d.AverageCollectionDays, err = optionalDays(q, "average_collection_days"); err != nil {
		return Declared{}, err
	}

	if raw, ok := q.Get("main_customer_concentration"); ok && raw != "" {
		value, parseErr := strconv.ParseFloat(raw, 64)
		if parseErr != nil || value < 0 || value > 1 {
			return Declared{}, fmt.Errorf(
				"main_customer_concentration: want a share between 0 and 1, got %q", raw)
		}
		d.MainCustomerConcentration = &value
	}
	return d, nil
}

// Apply fills the profile's unknowns, leaving every known value untouched.
func (d Declared) Apply(profile kernel.Company) kernel.Company {
	if profile.OpeningBalanceCents == nil {
		profile.OpeningBalanceCents = d.OpeningBalanceCents
	}
	if profile.PayrollCents == nil {
		profile.PayrollCents = d.PayrollCents
	}
	if profile.PayrollIntervalDays == nil {
		profile.PayrollIntervalDays = d.PayrollIntervalDays
	}
	if profile.MainCustomerConcentration == nil {
		profile.MainCustomerConcentration = d.MainCustomerConcentration
	}
	if profile.ContractedTermDays == nil {
		profile.ContractedTermDays = d.ContractedTermDays
	}
	if profile.AverageCollectionDays == nil {
		profile.AverageCollectionDays = d.AverageCollectionDays
	}
	return profile
}

// Any reports whether the caller declared anything at all, so a response can
// say that part of the profile was supplied rather than recorded.
func (d Declared) Any() bool {
	return d.PayrollCents != nil || d.PayrollIntervalDays != nil ||
		d.MainCustomerConcentration != nil || d.ContractedTermDays != nil ||
		d.AverageCollectionDays != nil || d.OpeningBalanceCents != nil
}

func optionalCents(q Query, name string) (*int64, error) {
	raw, ok := q.Get(name)
	if !ok || raw == "" {
		return nil, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return nil, fmt.Errorf("%s: want an integer count of cents, got %q", name, raw)
	}
	return &value, nil
}

func optionalDays(q Query, name string) (*int, error) {
	raw, ok := q.Get(name)
	if !ok || raw == "" {
		return nil, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return nil, fmt.Errorf("%s: want a non-negative number of days, got %q", name, raw)
	}
	return &value, nil
}
