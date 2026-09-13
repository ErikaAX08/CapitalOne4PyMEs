package kernel_test

import (
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

func ptr[T any](v T) *T { return &v }

func completeProfile() kernel.Company {
	return kernel.Company{
		CompanyID:                 "co_demo_agency",
		Currency:                  "MXN",
		OpeningBalanceCents:       ptr(int64(66000000)),
		PayrollCents:              ptr(int64(12000000)),
		PayrollIntervalDays:       ptr(15),
		MainCustomerConcentration: ptr(0.46),
		ContractedTermDays:        ptr(60),
		AverageCollectionDays:     ptr(45),
		RecurringRules: []kernel.RecurringRule{
			{ID: "base.payroll", Node: "payroll", Direction: "out",
				AmountCents: 12000000, FirstDay: 15, IntervalDays: 15},
		},
	}
}

// TestUnknownBalanceIsNotZero is the rule the whole abstention path rests on: an
// unknown value is nil and counts against coverage, it is never substituted with
// a confident zero.
func TestUnknownBalanceIsNotZero(t *testing.T) {
	profile := completeProfile()
	if known, total := profile.Coverage(); known != 7 || total != 7 {
		t.Fatalf("a complete profile reports %d/%d, want 7/7", known, total)
	}

	profile.OpeningBalanceCents = nil
	known, total := profile.Coverage()
	if known != 6 || total != 7 {
		t.Fatalf("an unknown balance reports %d/%d, want 6/7", known, total)
	}

	zeroed := completeProfile()
	zeroed.OpeningBalanceCents = ptr(int64(0))
	if k, _ := zeroed.Coverage(); k != 7 {
		t.Fatalf("a balance of zero reports %d known, want 7: zero is a value, not an absence", k)
	}
}

func TestValidateRejectsImpossibleProfiles(t *testing.T) {
	cases := map[string]func(*kernel.Company){
		"no company id":       func(c *kernel.Company) { c.CompanyID = "" },
		"foreign currency":    func(c *kernel.Company) { c.Currency = "USD" },
		"zero interval":       func(c *kernel.Company) { c.RecurringRules[0].IntervalDays = 0 },
		"unknown direction":   func(c *kernel.Company) { c.RecurringRules[0].Direction = "sideways" },
		"rule before cut-off": func(c *kernel.Company) { c.RecurringRules[0].FirstDay = -1 },
	}
	for name, corrupt := range cases {
		profile := completeProfile()
		corrupt(&profile)
		if err := profile.Validate(); err == nil {
			t.Errorf("%s: Validate accepted it", name)
		}
	}
	if err := completeProfile().Validate(); err != nil {
		t.Errorf("a complete profile was rejected: %v", err)
	}
}

// TestMovementMayNotPredateTheCutoff covers the invariant that no movement may
// carry a negative day offset: the engine never sees future information, and it
// never sees the past either.
func TestMovementMayNotPredateTheCutoff(t *testing.T) {
	profile := completeProfile()
	profile.OneOffMovements = []kernel.Movement{
		{ID: "m1", Node: "supplier", Direction: "out", Day: -3, AmountCents: 100},
	}
	if err := profile.Validate(); err == nil {
		t.Fatal("Validate accepted a movement dated before the cut-off")
	}
}
