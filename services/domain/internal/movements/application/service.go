package application

import (
	"context"
	"fmt"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Service is the movements context's use cases: read the company's ledger, and
// add one movement to it. It holds no HTTP and no SQL — both are adapters.
type Service struct {
	Repo   Repository
	Cutoff kernel.CutoffDate
}

// List returns the company's movements, most recent obligation first.
func (s Service) List(ctx context.Context, f Filter) ([]domain.Movement, error) {
	if f.CompanyID == "" {
		return nil, fmt.Errorf("%w: company_id is required", domain.ErrInvalid)
	}
	return s.Repo.List(ctx, f)
}

// Add validates a draft against the domain invariants, rejects a conflicting
// re-import, and persists it.
//
// The two failure modes are deliberately distinct: an invalid draft is the
// caller's mistake (domain.ErrInvalid), while a conflict is a collision with a
// fact already recorded (ErrConflict). The HTTP adapter maps them to 400 and
// 409 respectively.
func (s Service) Add(ctx context.Context, d domain.Draft) (domain.Movement, error) {
	nodes, err := s.nodeSet(ctx)
	if err != nil {
		return domain.Movement{}, err
	}
	m, err := domain.New(d, s.Cutoff, nodes)
	if err != nil {
		return domain.Movement{}, err
	}
	if m.SourceRef != "" {
		existing, err := s.Repo.BySourceRef(ctx, m.CompanyID, m.Source, m.SourceRef)
		if err != nil {
			return domain.Movement{}, err
		}
		for _, other := range existing {
			if m.Conflicts(other) {
				return domain.Movement{}, fmt.Errorf(
					"%w: %s/%s already exists as %s dated %s; correct that movement instead of re-importing it",
					ErrConflict, m.Source, m.SourceRef, other.ID, other.DueDate.ISO())
			}
		}
	}
	if err := s.Repo.Add(ctx, m); err != nil {
		return domain.Movement{}, err
	}
	return m, nil
}

// nodeSet loads the reference nodes. A repository that cannot answer yields an
// empty set, which accepts any node rather than rejecting valid input because
// the reference table could not be read.
func (s Service) nodeSet(ctx context.Context) (domain.NodeSet, error) {
	ids, err := s.Repo.Nodes(ctx)
	if err != nil {
		return nil, err
	}
	return domain.NewNodeSet(ids), nil
}
