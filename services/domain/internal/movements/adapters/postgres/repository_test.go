package postgres_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/adapters/postgres"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// These run against a real PostgreSQL. Point MOVEMENTS_TEST_DATABASE_URL at a
// database holding contracts/database/schema.sql; without it they skip, so the
// suite stays green on a machine with no database. The deployment target is
// Tiger Cloud, which is PostgreSQL with TimescaleDB — nothing exercised here is
// Timescale-specific, so a plain PostgreSQL is a faithful stand-in for
// everything except the partitioning itself.
const dsnVar = "MOVEMENTS_TEST_DATABASE_URL"

const testCompany = "co_test_ledger"

func repository(t *testing.T) *postgres.Repository {
	t.Helper()
	dsn := os.Getenv(dsnVar)
	if dsn == "" {
		t.Skipf("%s is not set; start a PostgreSQL with contracts/database/schema.sql applied", dsnVar)
	}
	repo, err := postgres.Open(context.Background(), dsn)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(repo.Close)

	// The company row the foreign key needs, and a clean ledger for each run.
	ctx := context.Background()
	if _, err := repo.Pool.Exec(ctx,
		`INSERT INTO companies (company_id, name) VALUES ($1, 'Ledger de prueba')
		 ON CONFLICT (company_id) DO NOTHING`, testCompany); err != nil {
		t.Fatalf("seeding the company: %v", err)
	}
	clean := func() {
		if _, err := repo.Pool.Exec(context.Background(),
			`DELETE FROM movements WHERE company_id = $1`, testCompany); err != nil {
			t.Fatalf("cleaning up: %v", err)
		}
	}
	clean()
	t.Cleanup(clean)
	return repo
}

func service(t *testing.T, repo *postgres.Repository) application.Service {
	t.Helper()
	cutoff, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatalf("cutoff: %v", err)
	}
	return application.Service{Repo: repo, Cutoff: cutoff}
}

func draft(t *testing.T, node, due string, cents int64, dir domain.Direction) domain.Draft {
	t.Helper()
	date, err := domain.ParseDate(due)
	if err != nil {
		t.Fatalf("date: %v", err)
	}
	return domain.Draft{
		CompanyID: testCompany,
		Node:      node,
		Direction: dir,
		DueDate:   date,
		Amount:    kernel.Money(cents),
		Source:    domain.Manual,
	}
}

func TestAddAndListRoundTripEveryField(t *testing.T) {
	repo := repository(t)
	svc := service(t, repo)
	ctx := context.Background()

	d := draft(t, "collection", "2026-09-20", 16000000, domain.In)
	d.Shift = domain.CollectionShift
	d.Scale = domain.SalesScale
	d.Exposure = domain.MainCustomer
	d.Provenance = domain.Declared
	d.Description = "Cobro de Comercial Atlas"
	d.SettledAmt = 4000000
	d.Status = domain.Confirmed

	stored, err := svc.Add(ctx, d)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	got, err := svc.List(ctx, application.Filter{CompanyID: testCompany})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("listed %d movements, want 1", len(got))
	}
	// Every column survives the round trip unchanged: a lossy mapping would
	// silently rewrite the ledger.
	if diff := got[0]; diff != stored {
		t.Errorf("the row read back differs from the one written:\n got %+v\nwant %+v", diff, stored)
	}
	if got[0].Outstanding() != kernel.Money(12000000) {
		t.Errorf("outstanding = %d, want 12000000", got[0].Outstanding().Cents())
	}
}

func TestListOrdersByDueDateDescendingAndFilters(t *testing.T) {
	repo := repository(t)
	svc := service(t, repo)
	ctx := context.Background()

	for _, row := range []struct {
		node, due string
		cents     int64
		dir       domain.Direction
	}{
		{"payroll", "2026-09-15", 7200000, domain.Out},
		{"collection", "2026-09-25", 16000000, domain.In},
		{"supplier", "2026-09-05", 2400000, domain.Out},
	} {
		if _, err := svc.Add(ctx, draft(t, row.node, row.due, row.cents, row.dir)); err != nil {
			t.Fatalf("Add %s: %v", row.node, err)
		}
	}

	all, err := svc.List(ctx, application.Filter{CompanyID: testCompany})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	want := []string{"2026-09-25", "2026-09-15", "2026-09-05"}
	for i, iso := range want {
		if all[i].DueDate.ISO() != iso {
			t.Fatalf("row %d is dated %s, want %s (most recent first)", i, all[i].DueDate.ISO(), iso)
		}
	}

	incoming, err := svc.List(ctx, application.Filter{CompanyID: testCompany, Direction: domain.In})
	if err != nil {
		t.Fatalf("List by direction: %v", err)
	}
	if len(incoming) != 1 || incoming[0].Node != "collection" {
		t.Errorf("filtering by direction returned %d rows, want the single collection", len(incoming))
	}

	from, _ := domain.ParseDate("2026-09-10")
	to, _ := domain.ParseDate("2026-09-20")
	window, err := svc.List(ctx, application.Filter{CompanyID: testCompany, From: from, To: to})
	if err != nil {
		t.Fatalf("List by window: %v", err)
	}
	if len(window) != 1 || window[0].Node != "payroll" {
		t.Errorf("the date window returned %d rows, want the single payroll", len(window))
	}

	limited, err := svc.List(ctx, application.Filter{CompanyID: testCompany, Limit: 2})
	if err != nil {
		t.Fatalf("List with a limit: %v", err)
	}
	if len(limited) != 2 {
		t.Errorf("limit 2 returned %d rows", len(limited))
	}
}

// The database still rejects an exact duplicate through movements_dedup.
func TestTheDedupIndexRejectsAnExactDuplicate(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	cutoff, _ := kernel.ParseCutoffDate("2026-09-12")

	d := draft(t, "collection", "2026-09-20", 16000000, domain.In)
	d.Source, d.SourceRef = domain.CFDI, "UUID-DUP"

	first, err := domain.New(d, cutoff, nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := repo.Add(ctx, first); err != nil {
		t.Fatalf("first Add: %v", err)
	}
	// A second row with the same company, source, reference and date collides
	// with the unique index even though its identity differs.
	second, _ := domain.New(d, cutoff, nil)
	if err := repo.Add(ctx, second); !errors.Is(err, application.ErrConflict) {
		t.Fatalf("error = %v, want ErrConflict from the dedup index", err)
	}
}

// The invariant the hypertable took away from the index: the same source_ref
// re-imported under a corrected date. The database accepts it — `due_date` is
// part of the key — so the use case has to be the one that refuses.
func TestTheServiceRejectsAReimportTheIndexWouldAccept(t *testing.T) {
	repo := repository(t)
	svc := service(t, repo)
	ctx := context.Background()

	d := draft(t, "collection", "2026-09-20", 16000000, domain.In)
	d.Source, d.SourceRef = domain.CFDI, "UUID-MOVED"
	if _, err := svc.Add(ctx, d); err != nil {
		t.Fatalf("first Add: %v", err)
	}

	corrected := d
	corrected.DueDate, _ = domain.ParseDate("2026-09-27")
	if _, err := svc.Add(ctx, corrected); !errors.Is(err, application.ErrConflict) {
		t.Fatalf("error = %v, want ErrConflict from the use case", err)
	}

	// Proof the guard is the use case and not the index: inserting the same
	// corrected row through the repository directly succeeds.
	cutoff, _ := kernel.ParseCutoffDate("2026-09-12")
	bypassed, _ := domain.New(corrected, cutoff, nil)
	if err := repo.Add(ctx, bypassed); err != nil {
		t.Fatalf("the database was expected to accept the corrected date, got: %v", err)
	}
}

// Every CHECK is verified by the domain first, so a violation can only reach the
// database if the two have drifted. This pins that they agree.
func TestTheDatabaseEnforcesTheSameChecksAsTheDomain(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	cutoff, _ := kernel.ParseCutoffDate("2026-09-12")

	valid, err := domain.New(draft(t, "payroll", "2026-09-18", 7200000, domain.Out), cutoff, nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	overSettled := valid
	overSettled.SettledAmt = valid.Amount + 1
	if err := repo.Add(ctx, overSettled); !errors.Is(err, domain.ErrInvalid) {
		t.Errorf("settled beyond the amount: error = %v, want ErrInvalid", err)
	}

	inconsistent := valid
	inconsistent.Status = domain.Settled // unpaid, so the CHECK must refuse it
	if err := repo.Add(ctx, inconsistent); !errors.Is(err, domain.ErrInvalid) {
		t.Errorf("settled status without reconciliation: error = %v, want ErrInvalid", err)
	}

	unknownNode := valid
	unknownNode.Node = "marketing" // no such row in graph_nodes
	if err := repo.Add(ctx, unknownNode); !errors.Is(err, domain.ErrInvalid) {
		t.Errorf("unknown node: error = %v, want ErrInvalid", err)
	}
}

// The twenty-four rows seeded from engine/graph.py.
func TestNodesReadsTheReferenceTable(t *testing.T) {
	repo := repository(t)
	nodes, err := repo.Nodes(context.Background())
	if err != nil {
		t.Fatalf("Nodes: %v", err)
	}
	if len(nodes) != 24 {
		t.Errorf("got %d graph nodes, want the 24 of contracts/database/schema.sql", len(nodes))
	}
	set := domain.NewNodeSet(nodes)
	for _, id := range []string{"payroll", "collection", "supplier", "tax"} {
		if !set.Has(id) {
			t.Errorf("the reference table is missing %q", id)
		}
	}
}
