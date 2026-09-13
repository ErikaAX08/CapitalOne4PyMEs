package domain

import "fmt"

// MaxSeed is the ceiling contracts/actions.schema.json declares for the run
// parameter.
const MaxSeed = 2147483647

// Seed fixes the Monte Carlo worlds. It is what makes a response a pure function
// of its query parameters, and therefore what makes the CloudFront cache correct
// rather than a bug (docs/architecture.md §1).
//
// A seed is fixed at scenario creation and never changes: a committed scenario
// is immutable.
type Seed int

// NewSeed validates the seed against the declared bounds.
func NewSeed(v int) (Seed, error) {
	if v < 0 || v > MaxSeed {
		return 0, fmt.Errorf("seed: %d outside [0, %d]", v, MaxSeed)
	}
	return Seed(v), nil
}

// Int returns the seed as a plain integer for the engine request.
func (s Seed) Int() int { return int(s) }

// Verification is the seed of the verification worlds. The report protocol
// searches the reinforcement on `seed` and verifies it on `seed + 1`
// (docs/evaluation-report.md §3); the engine derives it the same way, and it is
// named here so the domain states the rule rather than implying it.
func (s Seed) Verification() Seed { return s + 1 }
