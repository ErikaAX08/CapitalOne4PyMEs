package schema_test

import (
	"strings"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/adapters/schema"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
)

const contractsDir = "../../../../../../contracts"

type mapQuery map[string]string

func (q mapQuery) Get(id string) (string, bool) {
	v, ok := q[id]
	return v, ok
}

func load(t *testing.T) *schema.Catalog {
	t.Helper()
	catalog, err := schema.Load(contractsDir)
	if err != nil {
		t.Fatalf("loading %s: %v", schema.FileName, err)
	}
	return catalog
}

// TestDefaultsReproduceTheReportScenario is the acceptance criterion of PRD
// §3.2: a judge who touches nothing sees exactly the documented case — revenue
// $800,000, initial cost $380,000, advance 0%, collection at 60 days, 2 hires.
func TestDefaultsReproduceTheReportScenario(t *testing.T) {
	catalog := load(t)
	parameters, err := catalog.Parameters(domain.ActionAcceptProject, mapQuery{})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"total_revenue_cents": int64(80000000),
		"initial_cost_cents":  int64(38000000),
		"advance_pct":         0.0,
		"collection_days":     int64(60),
		"hires":               int64(2),
		"duration_days":       int64(30),
	}
	for id, expected := range want {
		if got := parameters[id]; got != expected {
			t.Errorf("%s = %#v, want %#v", id, got, expected)
		}
	}
}

// TestNoBoundIsRestatedInGo is the reason this adapter reads the contract rather
// than hard-coding it: moving a slider mark in the JSON must move it here with
// no Go change.
func TestNoBoundIsRestatedInGo(t *testing.T) {
	catalog := load(t)
	// The schema declares advance_pct at most 60; 61 must be refused, and the
	// message must name the bound the contract declares, not one Go invented.
	_, err := catalog.Parameters(domain.ActionAcceptProject, mapQuery{"advance_pct": "61"})
	if err == nil {
		t.Fatal("a value above the declared maximum was accepted")
	}
	if !strings.Contains(err.Error(), "advance_pct: 61.0 outside [0, 60]") {
		t.Errorf("error is %q, want it to name the contract's bounds", err)
	}
}

func TestCoercionByDeclaredType(t *testing.T) {
	catalog := load(t)
	parameters, err := catalog.Parameters(domain.ActionExtendCredit, mapQuery{
		"amount_cents":    "32000000",
		"collection_days": "45",
		"main_customer":   "false",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got, ok := parameters["amount_cents"].(int64); !ok || got != 32000000 {
		t.Errorf("money coerced to %#v, want int64(32000000)", parameters["amount_cents"])
	}
	if got, ok := parameters["main_customer"].(bool); !ok || got {
		t.Errorf("boolean coerced to %#v, want false", parameters["main_customer"])
	}
	// The contract declares main_customer's default as true.
	defaults, err := catalog.Parameters(domain.ActionExtendCredit, mapQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if got, ok := defaults["main_customer"].(bool); !ok || !got {
		t.Errorf("default main_customer = %#v, want true", defaults["main_customer"])
	}
}

func TestMalformedValuesAreRejected(t *testing.T) {
	catalog := load(t)
	cases := map[string]mapQuery{
		"money that is not a number":  {"amount_cents": "mucho"},
		"days that are a float":       {"collection_days": "45.5"},
		"boolean that is not boolean": {"main_customer": "quizás"},
	}
	for name, q := range cases {
		if _, err := catalog.Parameters(domain.ActionExtendCredit, q); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

// TestEmptyValueTakesTheDefault matches engine/contracts.py:_coerce, where an
// absent and an empty parameter are the same thing.
func TestEmptyValueTakesTheDefault(t *testing.T) {
	catalog := load(t)
	parameters, err := catalog.Parameters(domain.ActionAcceptProject, mapQuery{"hires": ""})
	if err != nil {
		t.Fatal(err)
	}
	if got := parameters["hires"]; got != int64(2) {
		t.Errorf("empty hires = %#v, want the schema default int64(2)", got)
	}
}

func TestStressAndRunComeFromTheContract(t *testing.T) {
	catalog := load(t)
	stress, err := catalog.Stress(mapQuery{"collection_delay_days": "16", "main_customer_lost": "true"})
	if err != nil {
		t.Fatal(err)
	}
	want := domain.Stress{CollectionDelayDays: 16, MainCustomerLost: true, CapitalInjectionCents: 0}
	if stress != want {
		t.Errorf("stress = %+v, want %+v", stress, want)
	}
	run, err := catalog.Run(mapQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if (run != application.Run{Paths: 5000, Seed: 42, HorizonDays: 180}) {
		t.Errorf("run defaults = %+v, want paths 5000, seed 42, horizon 180", run)
	}
}

func TestUnknownActionIsRefusedByName(t *testing.T) {
	catalog := load(t)
	_, err := catalog.Kind("aceptar_proyecto")
	if err == nil {
		t.Fatal("an action that the contract does not declare was accepted")
	}
	if !strings.Contains(err.Error(), "unknown action: aceptar_proyecto") {
		t.Errorf("error is %q, want it to name the rejected action", err)
	}
}

// TestBuilderDefaultsToTheDocumentedDecision covers PRD §3.2: accept_project
// carries `"default": true` and is what a request with no action gets.
func TestBuilderDefaultsToTheDocumentedDecision(t *testing.T) {
	catalog := load(t)
	builder := application.Builder{Catalog: catalog}
	cutoff := mustCutoff(t)
	scenario, err := builder.Build(mapQuery{}, cutoff)
	if err != nil {
		t.Fatal(err)
	}
	if scenario.Action().Kind() != domain.ActionAcceptProject {
		t.Errorf("default action = %s, want accept_project", scenario.Action().Kind())
	}
	if scenario.Seed().Int() != 42 || scenario.Paths() != 5000 || scenario.Horizon().Days() != 180 {
		t.Errorf("run defaults drifted: seed %d, paths %d, horizon %d",
			scenario.Seed().Int(), scenario.Paths(), scenario.Horizon().Days())
	}
}
