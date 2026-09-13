package company_test

import (
	"context"
	"errors"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/company"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// query is the URL-query port ParseDeclared reads through.
type query map[string]string

func (q query) Get(id string) (string, bool) {
	value, ok := q[id]
	return value, ok
}

func TestParseDeclaredReadsEveryProfileVariable(t *testing.T) {
	declared, err := company.ParseDeclared(query{
		"payroll_cents":               "8000000",
		"payroll_interval_days":       "15",
		"main_customer_concentration": "0.42",
		"contracted_term_days":        "60",
		"average_collection_days":     "71",
		"opening_balance_cents":       "100426118179",
	})
	if err != nil {
		t.Fatalf("ParseDeclared: %v", err)
	}
	if !declared.Any() {
		t.Error("Any() must report that something was declared")
	}
	if declared.PayrollCents == nil || *declared.PayrollCents != 8_000_000 {
		t.Errorf("payroll_cents = %v", declared.PayrollCents)
	}
	if declared.MainCustomerConcentration == nil || *declared.MainCustomerConcentration != 0.42 {
		t.Errorf("main_customer_concentration = %v", declared.MainCustomerConcentration)
	}
	if declared.ContractedTermDays == nil || *declared.ContractedTermDays != 60 {
		t.Errorf("contracted_term_days = %v", declared.ContractedTermDays)
	}
}

func TestParseDeclaredLeavesAbsentParametersUnknown(t *testing.T) {
	declared, err := company.ParseDeclared(query{})
	if err != nil {
		t.Fatalf("ParseDeclared: %v", err)
	}
	if declared.Any() {
		t.Error("an empty query declares nothing")
	}
	if declared.PayrollCents != nil || declared.ContractedTermDays != nil {
		t.Error("an absent parameter must stay nil, never a zero")
	}
	// An empty string is the same as absent: a form that submitted a blank
	// field has not declared a zero payroll.
	blank, err := company.ParseDeclared(query{"payroll_cents": ""})
	if err != nil {
		t.Fatalf("ParseDeclared: %v", err)
	}
	if blank.PayrollCents != nil {
		t.Error("a blank value must stay unknown")
	}
}

// A typo must be reported. Degrading it into an unknown would abstain without
// ever saying why.
func TestParseDeclaredRejectsMalformedValues(t *testing.T) {
	for name, raw := range map[string]string{
		"payroll_cents":               "ocho millones",
		"contracted_term_days":        "-1",
		"average_collection_days":     "60.5",
		"main_customer_concentration": "42",
		"opening_balance_cents":       "-100",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := company.ParseDeclared(query{name: raw}); err == nil {
				t.Fatalf("%s=%q was accepted", name, raw)
			}
		})
	}
}

// The rule that keeps a stored profile reachable: a declared value fills a
// hole, it never replaces a figure the repository recorded.
func TestApplyFillsOnlyTheUnknowns(t *testing.T) {
	recordedPayroll := int64(12_000_000)
	recordedTerm := 30
	stored := kernel.Company{
		CompanyID:    "01M29EKW00M30Q8774Q3NQWH2J",
		PayrollCents: &recordedPayroll,
		// ContractedTermDays and MainCustomerConcentration are unknown.
		ContractedTermDays: nil,
	}
	declaredPayroll := int64(999)
	declaredConcentration := 0.42
	declared := company.Declared{
		PayrollCents:              &declaredPayroll,
		MainCustomerConcentration: &declaredConcentration,
		ContractedTermDays:        &recordedTerm,
	}

	filled := declared.Apply(stored)
	if filled.PayrollCents == nil || *filled.PayrollCents != recordedPayroll {
		t.Errorf("payroll_cents = %v, want the recorded %d", filled.PayrollCents, recordedPayroll)
	}
	if filled.ContractedTermDays == nil || *filled.ContractedTermDays != recordedTerm {
		t.Errorf("contracted_term_days = %v, want the declared %d", filled.ContractedTermDays, recordedTerm)
	}
	if filled.MainCustomerConcentration == nil || *filled.MainCustomerConcentration != declaredConcentration {
		t.Errorf("main_customer_concentration = %v, want the declared value", filled.MainCustomerConcentration)
	}
}

// Declaring nothing must leave the profile byte-identical, so the default path
// cannot be changed by this feature existing.
func TestApplyWithNothingDeclaredChangesNothing(t *testing.T) {
	balance := int64(66_000_000)
	stored := kernel.Company{CompanyID: "co_demo_agency", OpeningBalanceCents: &balance}
	filled := company.Declared{}.Apply(stored)
	if filled.OpeningBalanceCents != stored.OpeningBalanceCents {
		t.Error("an empty declaration must not touch the profile")
	}
	if filled.PayrollCents != nil {
		t.Error("an empty declaration must not invent a value")
	}
}

// A company that does not exist and a database that did not answer are
// different answers; the fixture repository must name the first one so the
// server can map it to 404 rather than 503.
func TestFixtureReportsAnUnknownCompanyAsNotFound(t *testing.T) {
	repo, err := company.LoadFixture("../../../../../engine/fixtures/company_demo_agency.json")
	if err != nil {
		t.Skipf("the demo fixture is not readable from here: %v", err)
	}
	if _, err := repo.Profile(context.Background(), "nope"); !errors.Is(err, company.ErrNotFound) {
		t.Fatalf("error = %v, want ErrNotFound", err)
	}
	if _, err := repo.Profile(context.Background(), repo.DefaultCompanyID()); err != nil {
		t.Fatalf("the demo company must resolve: %v", err)
	}
}
