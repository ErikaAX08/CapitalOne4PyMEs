package domain

import "fmt"

// Stress holds the three controls applied on top of any decision (PRD §3.2,
// block 3). They are part of the parameterization, so they are part of the
// cache key and are echoed back in the state document.
type Stress struct {
	CollectionDelayDays   int
	MainCustomerLost      bool
	CapitalInjectionCents int64
}

// Validate enforces engine/stress.py:Stress.validate.
func (s Stress) Validate() error {
	if s.CollectionDelayDays < 0 || s.CapitalInjectionCents < 0 {
		return fmt.Errorf("stress controls must be non-negative")
	}
	return nil
}
