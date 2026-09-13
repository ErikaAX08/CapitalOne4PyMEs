// Package domain holds the scenario context's entities, value objects and
// invariants. It imports nothing from infrastructure and nothing from an
// adapters package; that purity is checked in CI.
package domain

import "fmt"

// ActionKind names one of the five decisions of docs/product-vision.md §8, plus
// `none` for the current operation. The set is closed and matches
// contracts/actions.schema.json.
type ActionKind string

const (
	ActionNone             ActionKind = "none"
	ActionAcceptProject    ActionKind = "accept_project"
	ActionExtendCredit     ActionKind = "extend_credit"
	ActionHireStaff        ActionKind = "hire_staff"
	ActionBuyAsset         ActionKind = "buy_asset"
	ActionRequestFinancing ActionKind = "request_financing"
)

// ActionKinds is the closed set, in the order the schema declares them.
var ActionKinds = []ActionKind{
	ActionNone, ActionAcceptProject, ActionExtendCredit,
	ActionHireStaff, ActionBuyAsset, ActionRequestFinancing,
}

// ParseActionKind maps a query-string value onto the closed set.
func ParseActionKind(s string) (ActionKind, error) {
	for _, k := range ActionKinds {
		if ActionKind(s) == k {
			return k, nil
		}
	}
	return "", fmt.Errorf("unknown action: %s", s)
}

// Action is an immutable value object that describes a decision. It knows
// nothing about Monte Carlo, probabilities or the interface.
//
// Deviation from services/domain/README.md, recorded deliberately: the
// documented interface also declares Apply(kernel.Calendar) kernel.Calendar.
// The cash calendar is owned by the Python engine (docs/architecture.md §6.1
// lists `cash` as "exists and is tested"), so implementing Apply here would be a
// second, untested engine and would break the invariant that compared actions
// share the same worlds. Go owns what Go can own: the closed set of kinds, the
// parameter invariants, and the immutability of a committed scenario. The
// calendar transformation stays in engine/actions.py.
type Action interface {
	// Kind identifies the decision.
	Kind() ActionKind
	// Validate enforces the action's own invariants.
	Validate() error
	// Parameters is the parameter set as the engine contract carries it:
	// integer cents, integer days, float percentages.
	Parameters() map[string]any
}

// action is the single implementation. The five decisions differ by their
// invariants, not by their structure, so one value object with a kind-dispatched
// Validate is honest about that; five near-identical structs would not be.
type action struct {
	kind       ActionKind
	parameters map[string]any
}

// NewAction builds an immutable action and enforces its invariants at
// construction: an invalid Action value never exists.
func NewAction(kind ActionKind, parameters map[string]any) (Action, error) {
	copied := make(map[string]any, len(parameters))
	for k, v := range parameters {
		copied[k] = v
	}
	a := action{kind: kind, parameters: copied}
	if err := a.Validate(); err != nil {
		return nil, err
	}
	return a, nil
}

func (a action) Kind() ActionKind { return a.kind }

func (a action) Parameters() map[string]any {
	copied := make(map[string]any, len(a.parameters))
	for k, v := range a.parameters {
		copied[k] = v
	}
	return copied
}

// number reads a numeric parameter. Every parameter reaching the domain has
// already been coerced to its declared type by the action catalogue, so a
// missing or non-numeric value is a programming error, reported as such.
func (a action) number(id string) (float64, error) {
	v, ok := a.parameters[id]
	if !ok {
		return 0, fmt.Errorf("%s: %s is required", a.kind, id)
	}
	switch n := v.(type) {
	case float64:
		return n, nil
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	default:
		return 0, fmt.Errorf("%s: %s is not a number", a.kind, id)
	}
}

// Validate enforces the invariants of docs/architecture.md §5.2 and
// engine/actions.py:Action.validate. Bounds declared in the schema are enforced
// by the catalogue; what lives here is what the schema cannot express: the
// relations between two parameters.
func (a action) Validate() error {
	found := false
	for _, k := range ActionKinds {
		if a.kind == k {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("unknown action: %s", a.kind)
	}
	for id, v := range a.parameters {
		if _, isBool := v.(bool); isBool {
			continue
		}
		if n, err := a.number(id); err == nil && n < 0 {
			return fmt.Errorf("%s must be non-negative", id)
		}
	}
	switch a.kind {
	case ActionAcceptProject:
		advance, err := a.number("advance_pct")
		if err != nil {
			return err
		}
		if advance < 0 || advance > 100 {
			return fmt.Errorf("advance_pct must lie in [0, 100]")
		}
		collection, err := a.number("collection_days")
		if err != nil {
			return err
		}
		duration := 30.0
		if _, ok := a.parameters["duration_days"]; ok {
			if duration, err = a.number("duration_days"); err != nil {
				return err
			}
		}
		// No movement may predate delivery: the balance cannot be collected
		// before the project is delivered and invoiced.
		if collection < duration {
			return fmt.Errorf("collection_days must not precede delivery")
		}
	case ActionBuyAsset:
		financed, err := a.number("financed_pct")
		if err != nil {
			return err
		}
		if financed < 0 || financed > 100 {
			return fmt.Errorf("financed_pct must lie in [0, 100]")
		}
	case ActionRequestFinancing:
		grace, err := a.number("grace_months")
		if err != nil {
			return err
		}
		term, err := a.number("term_months")
		if err != nil {
			return err
		}
		if grace >= term {
			return fmt.Errorf("grace_months must be shorter than term_months")
		}
	}
	return nil
}

// TotalRevenueCents is the revenue the action introduces. It exists to state the
// shared invariant explicitly: an action reschedules revenue in time, it never
// increases it, so this figure is an input the engine redistributes, not an
// amount the engine invents.
func (a action) TotalRevenueCents() int64 {
	switch a.kind {
	case ActionAcceptProject:
		n, _ := a.number("total_revenue_cents")
		return int64(n)
	case ActionRequestFinancing:
		n, _ := a.number("amount_cents")
		return int64(n)
	default:
		return 0
	}
}
