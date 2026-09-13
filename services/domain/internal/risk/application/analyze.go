package application

import (
	"context"
	"fmt"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Analyzer is the risk context's use case: assess one committed scenario against
// one company profile.
type Analyzer struct {
	Engine Engine
}

// Analyze runs the scenario and enforces the invariants the domain owns.
//
// The engine is authoritative on the numbers. The domain is authoritative on
// whether a number may be emitted at all, and on whether the run it got back is
// the run it asked for — the two checks that keep the abstention rule and the
// determinism claim from resting on the engine's good behaviour alone.
func (a Analyzer) Analyze(
	ctx context.Context,
	scenario scenariodomain.Scenario,
	company kernel.Company,
) (riskdomain.Assessment, error) {
	if err := company.Validate(); err != nil {
		return riskdomain.Assessment{}, err
	}
	assessment, err := a.Engine.Run(ctx, scenario, company)
	if err != nil {
		return riskdomain.Assessment{}, err
	}
	if !assessment.State.Valid() {
		return riskdomain.Assessment{}, fmt.Errorf(
			"engine returned an unknown state %q", assessment.State)
	}
	// Above 20% unknown variables the result is an abstention, not a probability.
	// Applied to the counts themselves, so it holds even if the engine's own
	// status said otherwise.
	if assessment.Coverage.RequiresAbstention() && !assessment.State.IsAbstention() {
		return riskdomain.Abstain(
			assessment.Coverage,
			assessment.EngineVersion,
			assessment.Seed,
			assessment.Paths,
			assessment.Horizon,
		), nil
	}
	// A response is a pure function of its parameters only if the engine ran the
	// parameters it was given. Drift here would silently break both the cache key
	// and the reproducibility the project's credibility rests on.
	if assessment.Seed != scenario.Seed().Int() {
		return riskdomain.Assessment{}, fmt.Errorf(
			"engine ran seed %d, scenario committed %d", assessment.Seed, scenario.Seed().Int())
	}
	if assessment.Horizon != scenario.Horizon() {
		return riskdomain.Assessment{}, fmt.Errorf(
			"engine ran a %d-day horizon, scenario committed %d",
			assessment.Horizon.Days(), scenario.Horizon().Days())
	}
	return assessment, nil
}
