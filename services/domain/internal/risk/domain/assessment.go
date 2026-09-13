package domain

import (
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Obligation is a dated commitment that goes uncovered on the deterministic path.
type Obligation struct {
	// Kind is the graph node id (`payroll`, `supplier`, `tax`, …).
	Kind string
	// Day is the offset from the cut-off date.
	Day int
	// Gap is how much is missing to cover it.
	Gap kernel.Money
}

// Survival answers "how long can I hold out?" over the deterministic path, with
// no random shock (PRD §3.1).
type Survival struct {
	Weeks int
	// UpperBounded is true when no gap appears within the horizon, so Weeks is
	// the bound the horizon allows us to assert rather than a measurement.
	UpperBounded bool
	State        State
	// First is nil exactly when UpperBounded is true.
	First *Obligation
	// NetRecurringFlow is recurring inflows minus outflows per 30 days. Negative
	// means the business bleeds cash regardless of timing: the audit trail
	// behind classifying a gap as structural rather than a timing problem.
	NetRecurringFlow kernel.Money
}

// Simulation is the Monte Carlo summary. Every probability declares its event
// and its horizon (docs/architecture.md §6.3).
type Simulation struct {
	Event        string
	HorizonDays  int
	Paths        int
	GapFrequency kernel.Probability
	// GapFrequencyByHorizon is the share of futures whose first uncovered
	// obligation falls within 30, 60 and 90 days.
	GapFrequencyByHorizon map[string]float64
	CI95                  kernel.Confidence
	MeanGap               kernel.Money
	P95Gap                kernel.Money
}

// RangeSource declares where a tension factor's reference range comes from. Two
// of the six are declared assumptions, and the interface must say so (PRD §3.3).
type RangeSource string

const (
	RangeDocumented         RangeSource = "documented"
	RangeControlRange       RangeSource = "control_range"
	RangeDeclaredAssumption RangeSource = "declared_assumption"
)

// TensionUnit names which margin/range pair a factor travels with, so the
// tooltip can show the computation in the right unit.
type TensionUnit string

const (
	UnitCents TensionUnit = "cents"
	UnitDays  TensionUnit = "days"
	UnitPP    TensionUnit = "pp"
	UnitRatio TensionUnit = "ratio"
)

// TensionFactor is one bar of Module C.
//
// Tension = 1 − (available margin ÷ reference range), clamped to [0, 1]. It is a
// normalisation of univariate tolerances, not a learned causal attribution. The
// factor carries its inputs so the figure is auditable rather than asserted.
type TensionFactor struct {
	Factor  string
	Stack   string
	Margin  float64
	Range   float64
	Unit    TensionUnit
	Tension float64
	Source  RangeSource
	// SearchBounded is true when no perturbation on the search grid opened a
	// gap, so the margin is the grid's edge and the tension a lower bound.
	SearchBounded *bool
}

// PropagationPath is the five-node chain of Module D.
type PropagationPath struct {
	Nodes  []string
	Origin string
	// Breaking is nil when nothing breaks: a stable structure has an origin but
	// no breaking node, and an empty string would read as a node named "".
	Breaking *string
}

// ReinforcementKind is the lever the counterfactual pulls.
type ReinforcementKind string

const (
	ReinforcementAdvance          ReinforcementKind = "advance"
	ReinforcementCapitalInjection ReinforcementKind = "capital_injection"
)

// Reinforcement is the smallest action that restores stability, found on the
// engine's one-percentage-point grid under the condition that the Wilson upper
// bound stay below 5%.
//
// Before and after come from the same parameterization over the same Monte Carlo
// worlds; comparing different worlds would invalidate the comparison.
type Reinforcement struct {
	Kind ReinforcementKind
	// Percentage and Amount are nil when the grid was exhausted without finding
	// a reinforcement that closes the gap.
	Percentage *float64
	Amount     *kernel.Money
	// AdditionalPercentage is what must be added to the advance the user already
	// asked for, as opposed to the total advance.
	AdditionalPercentage *float64
	// Required is false when the gap frequency is already under the tolerance.
	Required bool
	Found    bool

	GapFrequencyAfter kernel.Probability
	CI95After         kernel.Confidence
	WeeksAfter        int
	UpperBoundedAfter bool
	StateAfter        State
	GridPoints        int
}

// Assessment is the risk context's aggregate: everything the interface renders
// about one parameterization, in English and integer cents, with no presentation
// copy. Projecting it into the state document is a separate, later step.
type Assessment struct {
	State         State
	Coverage      Coverage
	EngineVersion string
	Seed          int
	Paths         int
	Horizon       kernel.Horizon

	// Survival, Simulation, Path and Reinforcement are nil on an abstention.
	Survival   *Survival
	Simulation *Simulation
	Tension    []TensionFactor
	Path       *PropagationPath
	// Reinforcement is also nil when the action is `none`: there is no decision
	// to reinforce.
	Reinforcement *Reinforcement

	// EffectiveCollectionDays is the day each collection actually lands after the
	// delay stress, keyed by movement id. The explanation is composed from it.
	EffectiveCollectionDays map[string]int
}

// Abstain builds the assessment emitted when coverage is too low. Modules A, C
// and D carry nothing, and that absence is the message.
func Abstain(coverage Coverage, engineVersion string, seed, paths int, horizon kernel.Horizon) Assessment {
	return Assessment{
		State:         StateAbstention,
		Coverage:      coverage,
		EngineVersion: engineVersion,
		Seed:          seed,
		Paths:         paths,
		Horizon:       horizon,
	}
}
