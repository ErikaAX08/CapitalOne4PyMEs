package domain_test

import (
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

func projectParameters() map[string]any {
	return map[string]any{
		"total_revenue_cents": int64(80000000),
		"initial_cost_cents":  int64(38000000),
		"advance_pct":         0.0,
		"collection_days":     int64(60),
		"hires":               int64(2),
		"duration_days":       int64(30),
	}
}

func cutoff(t *testing.T) kernel.CutoffDate {
	t.Helper()
	c, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// TestActionInvariants covers what the JSON schema cannot express: the relations
// between two parameters of the same decision.
func TestActionInvariants(t *testing.T) {
	cases := []struct {
		name       string
		kind       domain.ActionKind
		parameters map[string]any
		wantErr    bool
	}{
		{"the documented project", domain.ActionAcceptProject, projectParameters(), false},
		{"advance above 100%", domain.ActionAcceptProject, override(projectParameters(), "advance_pct", 120.0), true},
		{"negative revenue", domain.ActionAcceptProject, override(projectParameters(), "total_revenue_cents", int64(-1)), true},
		{
			"collection before delivery", domain.ActionAcceptProject,
			override(projectParameters(), "collection_days", int64(10)), true,
		},
		{
			"financed share above 100%", domain.ActionBuyAsset,
			map[string]any{"amount_cents": int64(4000000), "financed_pct": 150.0,
				"financing_term_months": int64(12), "delivery_days": int64(15)}, true,
		},
		{
			"grace as long as the term", domain.ActionRequestFinancing,
			map[string]any{"amount_cents": int64(3000000), "annual_rate_pct": 24.0,
				"term_months": int64(12), "grace_months": int64(12)}, true,
		},
		{
			"grace shorter than the term", domain.ActionRequestFinancing,
			map[string]any{"amount_cents": int64(3000000), "annual_rate_pct": 24.0,
				"term_months": int64(12), "grace_months": int64(3)}, false,
		},
		{"the current operation", domain.ActionNone, map[string]any{}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := domain.NewAction(c.kind, c.parameters)
			if c.wantErr && err == nil {
				t.Fatal("NewAction accepted an action that violates its invariants")
			}
			if !c.wantErr && err != nil {
				t.Fatalf("NewAction rejected a valid action: %v", err)
			}
		})
	}
}

func TestUnknownActionIsRejected(t *testing.T) {
	if _, err := domain.ParseActionKind("sell_the_company"); err == nil {
		t.Fatal("ParseActionKind accepted a decision that does not exist")
	}
}

// TestActionIsImmutable guards the value-object property: handing an action's
// parameters to a caller must not let the caller reach back into it.
func TestActionIsImmutable(t *testing.T) {
	action, err := domain.NewAction(domain.ActionAcceptProject, projectParameters())
	if err != nil {
		t.Fatal(err)
	}
	stolen := action.Parameters()
	stolen["total_revenue_cents"] = int64(1)
	if action.Parameters()["total_revenue_cents"] != int64(80000000) {
		t.Fatal("mutating the returned map changed the action")
	}
}

// TestScenarioRejectsRunParametersOutsideTheContract keeps the bounds of
// contracts/actions.schema.json → run enforced in the domain too, so a caller
// that bypasses the catalogue still cannot commit an inadmissible scenario.
func TestScenarioRejectsRunParametersOutsideTheContract(t *testing.T) {
	action, err := domain.NewAction(domain.ActionNone, nil)
	if err != nil {
		t.Fatal(err)
	}
	seed, err := domain.NewSeed(42)
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name    string
		paths   int
		horizon kernel.Horizon
	}{
		{"too few paths", 99, 180},
		{"too many paths", 20001, 180},
		{"horizon too short", 5000, 29},
		{"horizon too long", 5000, 366},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := domain.NewScenario(action, domain.Stress{}, seed, c.paths, c.horizon, cutoff(t)); err == nil {
				t.Fatal("NewScenario committed an inadmissible run")
			}
		})
	}
	if _, err := domain.NewScenario(action, domain.Stress{}, seed, 5000, 180, cutoff(t)); err != nil {
		t.Fatalf("NewScenario rejected a valid run: %v", err)
	}
}

func TestStressMustBeNonNegative(t *testing.T) {
	for _, s := range []domain.Stress{
		{CollectionDelayDays: -1},
		{CapitalInjectionCents: -1},
	} {
		if err := s.Validate(); err == nil {
			t.Errorf("%+v was accepted", s)
		}
	}
}

// TestSeedFixesTheVerificationWorlds records the report protocol: the
// reinforcement is searched on `seed` and verified on `seed + 1`.
func TestSeedFixesTheVerificationWorlds(t *testing.T) {
	seed, err := domain.NewSeed(781)
	if err != nil {
		t.Fatal(err)
	}
	if got := seed.Verification().Int(); got != 782 {
		t.Fatalf("verification seed = %d, want 782", got)
	}
	if _, err := domain.NewSeed(-1); err == nil {
		t.Fatal("NewSeed accepted a negative seed")
	}
}

func override(m map[string]any, key string, value any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	out[key] = value
	return out
}
