// Package application holds the movements context's use cases and the ports
// they depend on. Adapters implement the ports, so the use cases never reach
// for a driver and can be exercised without a database.
package application

import (
	"context"
	"errors"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
)

// ErrConflict is returned when a re-import carries an external identity that
// already exists with a different fact. The database cannot answer this on its
// own any more: the dedup index had to take `due_date` to satisfy the
// hypertable requirement, so this package enforces what
// docs/data-model.md §1 demands — "a conflicting re-import is rejected by the
// loader, not merged".
var ErrConflict = errors.New("conflicting re-import")

// Filter narrows a listing. The zero value lists every open movement of the
// company, which is what the interface opens on.
type Filter struct {
	CompanyID string
	Direction domain.Direction // empty means both
	Status    []domain.Status  // empty means every status
	From, To  domain.Date      // zero means unbounded
	Limit     int              // zero means the repository's default
}

// Repository is the port over persistence. `List` returns movements ordered by
// due date descending, the order a ledger is read in.
type Repository interface {
	List(ctx context.Context, f Filter) ([]domain.Movement, error)
	// BySourceRef yields the movements that already carry this external
	// identity, so Add can reject a conflicting re-import before inserting.
	BySourceRef(ctx context.Context, companyID string, source domain.Source, ref string) ([]domain.Movement, error)
	Add(ctx context.Context, m domain.Movement) error
	// Nodes yields the reference list of graph nodes a movement may name.
	Nodes(ctx context.Context) ([]string, error)
}
