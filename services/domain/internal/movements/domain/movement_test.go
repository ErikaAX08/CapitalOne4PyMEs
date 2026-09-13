package domain_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

const cutoffISO = "2026-09-12"

func cutoff(t *testing.T) kernel.CutoffDate {
	t.Helper()
	c, err := kernel.ParseCutoffDate(cutoffISO)
	if err != nil {
		t.Fatalf("cutoff: %v", err)
	}
	return c
}

func date(t *testing.T, iso string) domain.Date {
	t.Helper()
	d, err := domain.ParseDate(iso)
	if err != nil {
		t.Fatalf("date %q: %v", iso, err)
	}
	return d
}

// valid is the draft every test starts from: a payroll obligation dated after
// the cut-off, entered by hand.
func valid(t *testing.T) domain.Draft {
	t.Helper()
	return domain.Draft{
		CompanyID:   "co_demo_agency",
		Node:        "payroll",
		Direction:   domain.Out,
		DueDate:     date(t, "2026-09-18"),
		Amount:      kernel.Money(7200000),
		Source:      domain.Manual,
		Description: "Nómina de septiembre",
	}
}

func TestNewAppliesTheSchemaDefaults(t *testing.T) {
	m, err := domain.New(valid(t), cutoff(t), nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if m.Status != domain.Expected {
		t.Errorf("status = %q, want the schema default %q", m.Status, domain.Expected)
	}
	if m.Shift != domain.NoShift || m.Scale != domain.NoScale || m.Exposure != domain.NoExposure {
		t.Errorf("shift/scale/exposure = %q/%q/%q, want none/none/none", m.Shift, m.Scale, m.Exposure)
	}
	if m.Provenance != domain.Known {
		t.Errorf("provenance = %q, want %q", m.Provenance, domain.Known)
	}
	if len(m.ID) != 26 {
		t.Errorf("id = %q (%d chars), want a 26-character ULID", m.ID, len(m.ID))
	}
	// A movement due after the cut-off became knowable at the cut-off: today.
	if m.KnownAt.ISO() != cutoffISO {
		t.Errorf("known_at = %s, want the cut-off %s", m.KnownAt.ISO(), cutoffISO)
	}
}

func TestKnownAtDefaultsToTheDueDateWhenItIsInThePast(t *testing.T) {
	d := valid(t)
	d.DueDate = date(t, "2026-09-01")
	d.Status = domain.Delayed
	m, err := domain.New(d, cutoff(t), nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if m.KnownAt.ISO() != "2026-09-01" {
		t.Errorf("known_at = %s, want the due date 2026-09-01", m.KnownAt.ISO())
	}
}

// docs/data-model.md §3: "A movement with known_at > cutoff_date is future
// information and is rejected."
func TestNewRejectsFutureInformation(t *testing.T) {
	d := valid(t)
	d.KnownAt = date(t, "2026-09-13")
	_, err := domain.New(d, cutoff(t), nil)
	if !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
	if !strings.Contains(err.Error(), "future information") {
		t.Errorf("error = %q, want it to name the reason", err)
	}
}

// The movements_reconciliation CHECK of contracts/database/schema.sql.
func TestNewRejectsSettledBeyondTheAmount(t *testing.T) {
	d := valid(t)
	d.SettledAmt = d.Amount + 1
	if _, err := domain.New(d, cutoff(t), nil); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
}

// The movements_settled_consistent CHECK: `settled` is exactly a fully
// reconciled, non-zero movement, and `cancelled` is exempt.
func TestSettledStatusMustMatchTheReconciliation(t *testing.T) {
	for _, tc := range []struct {
		name    string
		status  domain.Status
		settled kernel.Money
		wantErr bool
	}{
		{"settled but unpaid", domain.Settled, 0, true},
		{"settled and fully paid", domain.Settled, 7200000, false},
		{"expected but fully paid", domain.Expected, 7200000, true},
		{"cancelled is exempt", domain.Cancelled, 7200000, false},
		{"cancelled and unpaid is exempt", domain.Cancelled, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := valid(t)
			d.Status, d.SettledAmt = tc.status, tc.settled
			_, err := domain.New(d, cutoff(t), nil)
			if tc.wantErr && !errors.Is(err, domain.ErrInvalid) {
				t.Fatalf("error = %v, want ErrInvalid", err)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("New: %v", err)
			}
		})
	}
}

func TestNewRejectsValuesOutsideTheSchemaEnums(t *testing.T) {
	for _, tc := range []struct {
		name  string
		spoil func(*domain.Draft)
	}{
		{"direction", func(d *domain.Draft) { d.Direction = "sideways" }},
		{"status", func(d *domain.Draft) { d.Status = "pending" }},
		{"source", func(d *domain.Draft) { d.Source = "spreadsheet" }},
		{"provenance", func(d *domain.Draft) { d.Provenance = "guessed" }},
		{"shift", func(d *domain.Draft) { d.Shift = "later" }},
		{"scale", func(d *domain.Draft) { d.Scale = "inflation" }},
		{"exposure", func(d *domain.Draft) { d.Exposure = "everyone" }},
		{"negative amount", func(d *domain.Draft) { d.Amount = -1 }},
		{"no company", func(d *domain.Draft) { d.CompanyID = "" }},
		{"no node", func(d *domain.Draft) { d.Node = "" }},
		{"no due date", func(d *domain.Draft) { d.DueDate = domain.Date{} }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := valid(t)
			tc.spoil(&d)
			if _, err := domain.New(d, cutoff(t), nil); !errors.Is(err, domain.ErrInvalid) {
				t.Fatalf("error = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestNewRejectsANodeOutsideTheGraph(t *testing.T) {
	nodes := domain.NewNodeSet([]string{"payroll", "collection"})
	d := valid(t)
	d.Node = "marketing"
	if _, err := domain.New(d, cutoff(t), nodes); !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("error = %v, want ErrInvalid", err)
	}
	d.Node = "collection"
	if _, err := domain.New(d, cutoff(t), nodes); err != nil {
		t.Fatalf("New with a known node: %v", err)
	}
}

// The invariant the hypertable took away from the database: a re-import of the
// same source_ref carrying a different fact is a conflict, not a second row.
func TestConflictsDetectsAChangedFactUnderTheSameSourceRef(t *testing.T) {
	base := valid(t)
	base.Source, base.SourceRef = domain.CFDI, "UUID-1"
	first, err := domain.New(base, cutoff(t), nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	same, _ := domain.New(base, cutoff(t), nil)
	if first.Conflicts(same) {
		t.Error("the same fact re-imported must not conflict")
	}

	for _, tc := range []struct {
		name  string
		alter func(*domain.Draft)
	}{
		{"a corrected date", func(d *domain.Draft) { d.DueDate = date(t, "2026-09-25") }},
		{"a corrected amount", func(d *domain.Draft) { d.Amount = 9900000 }},
		{"a different direction", func(d *domain.Draft) { d.Direction = domain.In }},
		{"a different node", func(d *domain.Draft) { d.Node = "supplier" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			altered := base
			tc.alter(&altered)
			other, err := domain.New(altered, cutoff(t), nil)
			if err != nil {
				t.Fatalf("New: %v", err)
			}
			if !first.Conflicts(other) {
				t.Errorf("%s must be reported as a conflict", tc.name)
			}
		})
	}

	// A movement with no external identity can never conflict: there is nothing
	// to match it against.
	anonymous, _ := domain.New(valid(t), cutoff(t), nil)
	if anonymous.Conflicts(first) {
		t.Error("a movement without a source_ref must not conflict")
	}
}

func TestOutstandingAndOpen(t *testing.T) {
	d := valid(t)
	d.SettledAmt = 2000000
	m, err := domain.New(d, cutoff(t), nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if got := m.Outstanding(); got != kernel.Money(5200000) {
		t.Errorf("outstanding = %d, want 5200000", got.Cents())
	}
	if !m.Open() {
		t.Error("an expected movement is open")
	}
	for _, status := range []domain.Status{domain.Settled, domain.Cancelled} {
		closed := m
		closed.Status = status
		if closed.Open() {
			t.Errorf("a %q movement is not open", status)
		}
	}
}

// The engine never sees a calendar date: it receives due_date − cutoff_date.
func TestDayIsTheOffsetFromTheCutoff(t *testing.T) {
	c := cutoff(t)
	for iso, want := range map[string]int{
		"2026-09-12": 0,
		"2026-09-18": 6,
		"2026-10-12": 30,
		"2026-09-01": -11,
	} {
		if got := date(t, iso).Day(c); got != want {
			t.Errorf("Day(%s) = %d, want %d", iso, got, want)
		}
	}
}

func TestNewULIDIsSortableAndWellFormed(t *testing.T) {
	const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
	base := time.Date(2026, 9, 12, 10, 0, 0, 0, time.UTC)
	earlier := domain.NewULID(base)
	later := domain.NewULID(base.Add(time.Second))

	for _, id := range []string{earlier, later} {
		if len(id) != 26 {
			t.Fatalf("ULID %q has %d characters, want 26", id, len(id))
		}
		for _, r := range id {
			if !strings.ContainsRune(alphabet, r) {
				t.Errorf("ULID %q carries %q, which is not in the Crockford alphabet", id, r)
			}
		}
	}
	if earlier >= later {
		t.Errorf("ULIDs must sort by time: %q should precede %q", earlier, later)
	}
	// The random suffix must actually differ between two calls at the same
	// instant; otherwise the identifier is not unique.
	if domain.NewULID(base) == domain.NewULID(base) {
		t.Error("two ULIDs generated at the same instant must still differ")
	}
}
