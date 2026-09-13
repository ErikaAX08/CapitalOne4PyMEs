package domain

// State is the structural verdict on a parameterization.
//
// Definitions, from docs/module-contract.md, Module A:
//   - Stable: no obligation goes uncovered within the horizon.
//   - Tension: a timing gap — recurring flow is positive and the path ends
//     positive, so there is margin to reinforce.
//   - Crisis: the gap is structural — recurring flow is negative, or the path
//     ends negative, or the first uncovered obligation falls within four weeks.
//   - Abstention: coverage is too low to say anything at all.
type State string

const (
	StateStable     State = "stable"
	StateTension    State = "tension"
	StateCrisis     State = "crisis"
	StateAbstention State = "abstention"
)

// Valid reports whether s is one of the four states.
func (s State) Valid() bool {
	switch s {
	case StateStable, StateTension, StateCrisis, StateAbstention:
		return true
	}
	return false
}

// IsAbstention reports whether no estimate was emitted.
func (s State) IsAbstention() bool { return s == StateAbstention }
