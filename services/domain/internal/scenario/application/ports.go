// Package application holds the scenario context's use cases and the ports they
// depend on. The implementations live in adapters; the dependency is inverted so
// the domain never reaches for infrastructure.
package application

import "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"

// Query is the read side of a request's parameters. A query string satisfies it,
// and so does a test map: the use case does not know which.
type Query interface {
	// Get returns the raw value for a parameter id and whether it was present.
	Get(id string) (string, bool)
}

// Run holds the three run parameters of contracts/actions.schema.json → run.
type Run struct {
	Paths       int
	Seed        int
	HorizonDays int
}

// ActionCatalog is the port over contracts/actions.schema.json. It is the single
// source of truth for which decisions exist, which parameters they take, and
// what bounds and defaults those parameters have — the same file the front-end
// generates its form from and the engine coerces its query with.
type ActionCatalog interface {
	// Kind resolves a raw action id against the closed set the schema declares.
	Kind(raw string) (domain.ActionKind, error)
	// Parameters coerces and bounds-checks the parameters of one decision,
	// filling in the schema default for anything the query omits.
	Parameters(kind domain.ActionKind, q Query) (map[string]any, error)
	// Stress coerces the three stress controls.
	Stress(q Query) (domain.Stress, error)
	// Run coerces the three run parameters.
	Run(q Query) (Run, error)
}
