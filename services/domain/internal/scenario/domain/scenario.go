package domain

import (
	"fmt"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Run parameter bounds, from contracts/actions.schema.json → run.parameters.
const (
	MinPaths       = 100
	MaxPaths       = 20000
	MinHorizonDays = 30
	MaxHorizonDays = 365
)

// Scenario is the aggregate of the scenario context: one decision, one stress
// parameterization and the run parameters, bound to a cut-off date.
//
// It is immutable. Every field is unexported and the only constructor validates
// every invariant, so a Scenario value that exists is a Scenario that was
// admissible. That is what makes it addressable by a parameter hash and
// cacheable (docs/data-model.md §2, `scenarios.parameter_hash`).
type Scenario struct {
	action  Action
	stress  Stress
	seed    Seed
	paths   int
	horizon kernel.Horizon
	cutoff  kernel.CutoffDate
}

// NewScenario commits a scenario. The seed is fixed here and never changes.
func NewScenario(
	action Action,
	stress Stress,
	seed Seed,
	paths int,
	horizon kernel.Horizon,
	cutoff kernel.CutoffDate,
) (Scenario, error) {
	if action == nil {
		return Scenario{}, fmt.Errorf("action is required")
	}
	if err := action.Validate(); err != nil {
		return Scenario{}, err
	}
	if err := stress.Validate(); err != nil {
		return Scenario{}, err
	}
	if paths < MinPaths || paths > MaxPaths {
		return Scenario{}, fmt.Errorf("paths: %d outside [%d, %d]", paths, MinPaths, MaxPaths)
	}
	days := horizon.Days()
	if days < MinHorizonDays || days > MaxHorizonDays {
		return Scenario{}, fmt.Errorf(
			"horizon_days: %d outside [%d, %d]", days, MinHorizonDays, MaxHorizonDays)
	}
	if cutoff.IsZero() {
		return Scenario{}, fmt.Errorf("cutoff_date is required")
	}
	return Scenario{
		action:  action,
		stress:  stress,
		seed:    seed,
		paths:   paths,
		horizon: horizon,
		cutoff:  cutoff,
	}, nil
}

func (s Scenario) Action() Action            { return s.action }
func (s Scenario) Stress() Stress            { return s.stress }
func (s Scenario) Seed() Seed                { return s.seed }
func (s Scenario) Paths() int                { return s.paths }
func (s Scenario) Horizon() kernel.Horizon   { return s.horizon }
func (s Scenario) Cutoff() kernel.CutoffDate { return s.cutoff }
