package application

import (
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// DefaultAction is the decision the schema marks as `"default": true`: the demo
// case docs/evaluation-report.md §3 backs.
const DefaultAction = "accept_project"

// Builder turns a request's parameters into a committed Scenario. It is the
// scenario context's only entry point: nothing else constructs a Scenario.
type Builder struct {
	Catalog ActionCatalog
}

// Build validates the query against the action schema and commits the scenario.
// The seed is fixed here, once, and the resulting value object is immutable.
func (b Builder) Build(q Query, cutoff kernel.CutoffDate) (domain.Scenario, error) {
	raw, ok := q.Get("action")
	if !ok || raw == "" {
		raw = DefaultAction
	}
	kind, err := b.Catalog.Kind(raw)
	if err != nil {
		return domain.Scenario{}, err
	}
	parameters, err := b.Catalog.Parameters(kind, q)
	if err != nil {
		return domain.Scenario{}, err
	}
	action, err := domain.NewAction(kind, parameters)
	if err != nil {
		return domain.Scenario{}, err
	}
	stress, err := b.Catalog.Stress(q)
	if err != nil {
		return domain.Scenario{}, err
	}
	run, err := b.Catalog.Run(q)
	if err != nil {
		return domain.Scenario{}, err
	}
	seed, err := domain.NewSeed(run.Seed)
	if err != nil {
		return domain.Scenario{}, err
	}
	return domain.NewScenario(
		action, stress, seed, run.Paths, kernel.Horizon(run.HorizonDays), cutoff)
}
