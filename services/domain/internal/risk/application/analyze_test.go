package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/application"
	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// fakeEngine returns whatever the test hands it, so the use case's own rules can
// be exercised without a Python process.
type fakeEngine struct {
	assessment riskdomain.Assessment
	err        error
	calls      int
}

func (f *fakeEngine) Run(
	context.Context, scenariodomain.Scenario, kernel.Company,
) (riskdomain.Assessment, error) {
	f.calls++
	return f.assessment, f.err
}

func ptr[T any](v T) *T { return &v }

func company() kernel.Company {
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

func scenario(t *testing.T) scenariodomain.Scenario {
	t.Helper()
	action, err := scenariodomain.NewAction(scenariodomain.ActionNone, nil)
	if err != nil {
		t.Fatal(err)
	}
	seed, err := scenariodomain.NewSeed(42)
	if err != nil {
		t.Fatal(err)
	}
	cutoff, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatal(err)
	}
	s, err := scenariodomain.NewScenario(action, scenariodomain.Stress{}, seed, 5000, 180, cutoff)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func healthy() riskdomain.Assessment {
	return riskdomain.Assessment{
		State:         riskdomain.StateStable,
		Coverage:      riskdomain.NewCoverage(7, 7),
		EngineVersion: "1.0.0",
		Seed:          42,
		Paths:         5000,
		Horizon:       180,
		Survival:      &riskdomain.Survival{Weeks: 25, UpperBounded: true, State: riskdomain.StateStable},
		Simulation:    &riskdomain.Simulation{Event: "uncovered_obligation", Paths: 5000},
	}
}

func TestAnalyzeReturnsTheAssessment(t *testing.T) {
	engine := &fakeEngine{assessment: healthy()}
	got, err := application.Analyzer{Engine: engine}.Analyze(
		context.Background(), scenario(t), company())
	if err != nil {
		t.Fatal(err)
	}
	if got.State != riskdomain.StateStable || engine.calls != 1 {
		t.Fatalf("state %s after %d engine calls, want stable after 1", got.State, engine.calls)
	}
}

// TestAbstentionIsEnforcedOnTheCounts is the point of applying the rule in Go as
// well as in Python: even if the engine reported a confident state, coverage
// below the threshold overrides it.
func TestAbstentionIsEnforcedOnTheCounts(t *testing.T) {
	assessment := healthy()
	assessment.Coverage = riskdomain.NewCoverage(5, 7) // 28.6% unknown
	got, err := application.Analyzer{Engine: &fakeEngine{assessment: assessment}}.Analyze(
		context.Background(), scenario(t), company())
	if err != nil {
		t.Fatal(err)
	}
	if !got.State.IsAbstention() {
		t.Fatalf("state = %s, want abstention: the engine claimed %s at 28.6%% unknown",
			got.State, assessment.State)
	}
	if got.Survival != nil || got.Simulation != nil {
		t.Error("an abstention still carries survival or simulation figures")
	}
	if got.EngineVersion != "1.0.0" {
		t.Errorf("engine version lost on abstention: %q", got.EngineVersion)
	}
}

// TestSeedDriftIsAnError guards determinism: if the engine ran a seed the
// scenario did not commit, the response is no longer a pure function of the
// query and caching it would serve the wrong document.
func TestSeedDriftIsAnError(t *testing.T) {
	assessment := healthy()
	assessment.Seed = 43
	_, err := application.Analyzer{Engine: &fakeEngine{assessment: assessment}}.Analyze(
		context.Background(), scenario(t), company())
	if err == nil {
		t.Fatal("a seed mismatch between the scenario and the engine was accepted")
	}
}

func TestHorizonDriftIsAnError(t *testing.T) {
	assessment := healthy()
	assessment.Horizon = 90
	_, err := application.Analyzer{Engine: &fakeEngine{assessment: assessment}}.Analyze(
		context.Background(), scenario(t), company())
	if err == nil {
		t.Fatal("a horizon mismatch between the scenario and the engine was accepted")
	}
}

func TestUnknownStateIsAnError(t *testing.T) {
	assessment := healthy()
	assessment.State = "precaución"
	_, err := application.Analyzer{Engine: &fakeEngine{assessment: assessment}}.Analyze(
		context.Background(), scenario(t), company())
	if err == nil {
		t.Fatal("an unknown state from the engine was accepted")
	}
}

func TestInvalidProfileNeverReachesTheEngine(t *testing.T) {
	broken := company()
	broken.Currency = "USD"
	engine := &fakeEngine{assessment: healthy()}
	if _, err := (application.Analyzer{Engine: engine}).Analyze(
		context.Background(), scenario(t), broken); err == nil {
		t.Fatal("an invalid profile was analysed")
	}
	if engine.calls != 0 {
		t.Errorf("the engine was called %d times with an invalid profile", engine.calls)
	}
}

func TestEngineFailurePropagates(t *testing.T) {
	sentinel := errors.New("engine unreachable")
	_, err := application.Analyzer{Engine: &fakeEngine{err: sentinel}}.Analyze(
		context.Background(), scenario(t), company())
	if !errors.Is(err, sentinel) {
		t.Fatalf("error = %v, want the engine's own error", err)
	}
}
