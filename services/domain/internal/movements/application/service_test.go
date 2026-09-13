package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// stub is an in-memory Repository. The use cases hold no SQL, so they are
// exercised without a database; the adapter has its own integration test.
type stub struct {
	rows     []domain.Movement
	nodes    []string
	addErr   error
	listErr  error
	nodesErr error
	added    int
}

func (s *stub) List(context.Context, application.Filter) ([]domain.Movement, error) {
	return s.rows, s.listErr
}

func (s *stub) BySourceRef(_ context.Context, companyID string, source domain.Source, ref string) ([]domain.Movement, error) {
	var out []domain.Movement
	for _, m := range s.rows {
		if m.CompanyID == companyID && m.Source == source && m.SourceRef == ref {
			out = append(out, m)
		}
	}
	return out, nil
}

func (s *stub) Add(_ context.Context, m domain.Movement) error {
	if s.addErr != nil {
		return s.addErr
	}
	s.rows = append(s.rows, m)
	s.added++
	return nil
}

func (s *stub) Nodes(context.Context) ([]string, error) { return s.nodes, s.nodesErr }

func service(t *testing.T, repo *stub) application.Service {
	t.Helper()
	cutoff, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatalf("cutoff: %v", err)
	}
	return application.Service{Repo: repo, Cutoff: cutoff}
}

func draft(t *testing.T, ref string) domain.Draft {
	t.Helper()
	due, err := domain.ParseDate("2026-09-18")
	if err != nil {
		t.Fatalf("date: %v", err)
	}
	return domain.Draft{
		CompanyID: "co_demo_agency",
		Node:      "payroll",
		Direction: domain.Out,
		DueDate:   due,
		Amount:    kernel.Money(7200000),
		Source:    domain.CFDI,
		SourceRef: ref,
	}
}

func TestAddPersistsAValidDraft(t *testing.T) {
	repo := &stub{nodes: []string{"payroll", "collection"}}
	m, err := service(t, repo).Add(context.Background(), draft(t, "UUID-1"))
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if repo.added != 1 {
		t.Errorf("added %d rows, want 1", repo.added)
	}
	if m.ID == "" {
		t.Error("the returned movement carries no identity")
	}
}

func TestAddRejectsAnInvalidDraftWithoutTouchingTheRepository(t *testing.T) {
	repo := &stub{nodes: []string{"payroll"}}
	d := draft(t, "UUID-1")
	d.Node = "marketing" // not a graph node
	_, err := service(t, repo).Add(context.Background(), d)
	if !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
	if repo.added != 0 {
		t.Error("an invalid draft must not reach the repository")
	}
}

// docs/data-model.md §1: a conflicting re-import is rejected, not merged. The
// hypertable's dedup index can no longer enforce it, so the use case does.
func TestAddRejectsAConflictingReimport(t *testing.T) {
	repo := &stub{nodes: []string{"payroll"}}
	svc := service(t, repo)
	if _, err := svc.Add(context.Background(), draft(t, "UUID-1")); err != nil {
		t.Fatalf("first Add: %v", err)
	}

	corrected := draft(t, "UUID-1")
	corrected.Amount = 9900000 // same external identity, different fact
	_, err := svc.Add(context.Background(), corrected)
	if !errors.Is(err, application.ErrConflict) {
		t.Fatalf("error = %v, want ErrConflict", err)
	}
	if repo.added != 1 {
		t.Errorf("added %d rows, want the conflicting one to be refused", repo.added)
	}
}

func TestAddAcceptsAnIdenticalReimportAndAMovementWithoutASourceRef(t *testing.T) {
	repo := &stub{nodes: []string{"payroll"}}
	svc := service(t, repo)
	if _, err := svc.Add(context.Background(), draft(t, "UUID-1")); err != nil {
		t.Fatalf("first Add: %v", err)
	}
	// The same fact twice is not a conflict: the dedup index decides.
	if _, err := svc.Add(context.Background(), draft(t, "UUID-1")); err != nil {
		t.Fatalf("identical re-import: %v", err)
	}
	anonymous := draft(t, "")
	anonymous.Source = domain.Manual
	if _, err := svc.Add(context.Background(), anonymous); err != nil {
		t.Fatalf("manual movement: %v", err)
	}
}

func TestListRequiresACompany(t *testing.T) {
	_, err := service(t, &stub{}).List(context.Background(), application.Filter{})
	if !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

func TestFailuresFromTheRepositorySurface(t *testing.T) {
	boom := errors.New("connection refused")
	t.Run("on list", func(t *testing.T) {
		_, err := service(t, &stub{listErr: boom}).List(
			context.Background(), application.Filter{CompanyID: "co_demo_agency"})
		if !errors.Is(err, boom) {
			t.Fatalf("error = %v, want the repository's", err)
		}
	})
	t.Run("on add", func(t *testing.T) {
		_, err := service(t, &stub{addErr: boom}).Add(context.Background(), draft(t, ""))
		if !errors.Is(err, boom) {
			t.Fatalf("error = %v, want the repository's", err)
		}
	})
	t.Run("on nodes", func(t *testing.T) {
		_, err := service(t, &stub{nodesErr: boom}).Add(context.Background(), draft(t, ""))
		if !errors.Is(err, boom) {
			t.Fatalf("error = %v, want the repository's", err)
		}
	})
}
