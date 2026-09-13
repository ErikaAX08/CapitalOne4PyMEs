package engine_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
)

const capturedResults = "../projection/testdata"

func read(t *testing.T, name string) []byte {
	t.Helper()
	blob, err := os.ReadFile(filepath.Join(capturedResults, name))
	if err != nil {
		t.Fatalf("reading %s: %v", name, err)
	}
	return blob
}

// TestTranslateTheDocumentedScenario checks the ACL against the figures
// docs/evaluation-report.md §3 and PRD §3.3 pin: payroll uncovered on day 75 by
// $40,000, six tension factors led by payroll coverage at 1.00.
func TestTranslateTheDocumentedScenario(t *testing.T) {
	assessment, err := engineadapter.Translate(read(t, "tension.result.json"))
	if err != nil {
		t.Fatal(err)
	}
	if assessment.State != riskdomain.StateTension {
		t.Errorf("state = %s, want tension", assessment.State)
	}
	if assessment.Survival == nil || assessment.Survival.First == nil {
		t.Fatal("the translated assessment carries no first obligation")
	}
	first := assessment.Survival.First
	if first.Kind != "payroll" || first.Day != 75 || first.Gap.Cents() != 4000000 {
		t.Errorf("first obligation = %s on day %d short %d cents; want payroll, 75, 4000000",
			first.Kind, first.Day, first.Gap.Cents())
	}
	if len(assessment.Tension) != 6 {
		t.Fatalf("%d tension factors, want the six of PRD §3.3", len(assessment.Tension))
	}
	if assessment.Tension[0].Factor != "payroll_coverage" || assessment.Tension[0].Tension != 1.0 {
		t.Errorf("leading factor = %s at %.2f, want payroll_coverage at 1.00",
			assessment.Tension[0].Factor, assessment.Tension[0].Tension)
	}
	// Every factor must arrive with the pair it was computed from, or the
	// tooltip cannot show the computation and the bar is an assertion.
	for _, f := range assessment.Tension {
		if f.Unit == "" {
			t.Errorf("factor %s carries no margin/range unit", f.Factor)
		}
	}
}

// TestTranslateAppliesTheAbstentionRule covers the boundary docs/architecture.md
// §6.2 describes: the rule is applied to the raw counts here, not read off the
// engine's status field.
func TestTranslateAppliesTheAbstentionRule(t *testing.T) {
	raw := []byte(`{
	  "status": "ok",
	  "engine_version": "1.0.0",
	  "seed": 42, "paths": 5000, "horizon_days": 180,
	  "coverage": {"known_variables": 5, "total_variables": 7, "unknown_fraction": 0.2857},
	  "survival": {"weeks": 25, "upper_bounded": true, "state": "stable",
	               "first_obligation": null, "net_recurring_flow_cents": 0},
	  "simulation": {"event": "uncovered_obligation", "paths": 5000, "gap_frequency": 0.0,
	                 "gap_frequency_by_horizon": {"30": 0, "60": 0, "90": 0},
	                 "ci95": [0, 0], "mean_gap_cents": 0, "p95_gap_cents": 0},
	  "tension": [], "propagation_path": null, "minimum_reinforcement": null,
	  "effective_collection_days": {}
	}`)
	assessment, err := engineadapter.Translate(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !assessment.State.IsAbstention() {
		t.Fatalf("state = %s, want abstention at 28.6%% unknown", assessment.State)
	}
	if assessment.Survival != nil {
		t.Error("an abstention carries a survival figure")
	}
}

// TestTranslateSurfacesEngineErrors keeps a rejected parameter distinguishable
// from a broken run, so the HTTP layer can answer 400 rather than 502.
func TestTranslateSurfacesEngineErrors(t *testing.T) {
	raw := []byte(`{"status":"error","error":"ParameterError","message":"advance_pct must lie in [0, 100]"}`)
	_, err := engineadapter.Translate(raw)
	var engineErr *engineadapter.EngineError
	if !errors.As(err, &engineErr) {
		t.Fatalf("error = %v, want an EngineError", err)
	}
	if !engineErr.IsParameterError() {
		t.Errorf("%q was not recognised as a parameter error", engineErr.Type)
	}
	if engineErr.Message != "advance_pct must lie in [0, 100]" {
		t.Errorf("message = %q, want the engine's own", engineErr.Message)
	}
}

func TestTranslateRejectsMalformedOutput(t *testing.T) {
	if _, err := engineadapter.Translate([]byte("not json")); err == nil {
		t.Fatal("malformed engine output was accepted")
	}
	if _, err := engineadapter.Translate([]byte(`{"status":"perplexed"}`)); err == nil {
		t.Fatal("an unknown engine status was accepted")
	}
}

// TestStablePathHasNoBreakingNode covers the nullable field: a stable structure
// has an origin but nothing that breaks, and an empty string would read as a
// node whose name happens to be empty.
func TestStablePathHasNoBreakingNode(t *testing.T) {
	assessment, err := engineadapter.Translate(read(t, "base.result.json"))
	if err != nil {
		t.Fatal(err)
	}
	if assessment.State != riskdomain.StateStable {
		t.Fatalf("state = %s, want stable for the current operation", assessment.State)
	}
	if assessment.Path == nil {
		t.Fatal("no propagation path")
	}
	if assessment.Path.Breaking != nil {
		t.Errorf("breaking node = %q on a stable structure, want none", *assessment.Path.Breaking)
	}
	if assessment.Reinforcement != nil {
		t.Error("the current operation carries a reinforcement; there is no decision to reinforce")
	}
}
