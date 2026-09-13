// Package domain holds the movements context: one dated receipt or obligation
// of the SME, with the invariants docs/data-model.md §3 declares.
//
// It imports no infrastructure. The vocabulary is the one the `movements` table
// and contracts/engine-request.schema.json already use, so a row, a request
// field and a domain value all read the same.
package domain

import (
	"errors"
	"fmt"
	"time"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Direction says whether the movement brings money in or takes it out.
type Direction string

// Status is the reconciliation state the loader derives; it is never typed by
// hand (docs/data-model.md §1).
type Status string

// Source is where the fact came from. `manual` is the one a person enters.
type Source string

// Provenance declares how much the figure is known versus assumed.
type Provenance string

// Shift names the stochastic delay that moves the movement, Scale the factor
// that scales it, and Exposure whether the amount carries the main customer's
// share. They exist because the engine reads them; the interface only shows them.
type (
	Shift    string
	Scale    string
	Exposure string
)

// The complete value sets, copied from contracts/database/schema.sql. A value
// outside them is rejected here rather than by the database, so the error names
// the field instead of surfacing a driver message.
const (
	In  Direction = "in"
	Out Direction = "out"

	Expected  Status = "expected"
	Confirmed Status = "confirmed"
	Delayed   Status = "delayed"
	Settled   Status = "settled"
	Cancelled Status = "cancelled"

	Bank   Source = "bank"
	CFDI   Source = "cfdi"
	Manual Source = "manual"
	Rule   Source = "rule"
	Action Source = "action"

	Known        Provenance = "known"
	Declared     Provenance = "declared"
	Learned      Provenance = "learned"
	Hypothetical Provenance = "hypothetical"

	NoShift         Shift    = "none"
	DeliveryShift   Shift    = "delivery"
	CollectionShift Shift    = "collection"
	NoScale         Scale    = "none"
	SalesScale      Scale    = "sales"
	CostScale       Scale    = "cost"
	NoExposure      Exposure = "none"
	MainCustomer    Exposure = "main_customer"
)

var (
	directions  = []Direction{In, Out}
	statuses    = []Status{Expected, Confirmed, Delayed, Settled, Cancelled}
	sources     = []Source{Bank, CFDI, Manual, Rule, Action}
	provenances = []Provenance{Known, Declared, Learned, Hypothetical}
	shifts      = []Shift{NoShift, DeliveryShift, CollectionShift}
	scales      = []Scale{NoScale, SalesScale, CostScale}
	exposures   = []Exposure{NoExposure, MainCustomer}
)

// ErrInvalid is the class of every rejection this package raises. Callers match
// on it to answer 400 rather than 500.
var ErrInvalid = errors.New("invalid movement")

// Date is a calendar date with no time and no zone. The engine never sees one:
// it receives `due_date − cutoff_date` as an integer day offset, which is what
// Day below computes.
type Date struct{ t time.Time }

// ParseDate reads an ISO-8601 date (YYYY-MM-DD).
func ParseDate(iso string) (Date, error) {
	t, err := time.Parse(time.DateOnly, iso)
	if err != nil {
		return Date{}, fmt.Errorf("%w: %q is not an ISO-8601 date", ErrInvalid, iso)
	}
	return NewDate(t), nil
}

// NewDate normalises a time to the calendar date it falls on, in UTC.
func NewDate(t time.Time) Date {
	return Date{t: time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
}

// ISO renders the date as YYYY-MM-DD.
func (d Date) ISO() string { return d.t.Format(time.DateOnly) }

// Time returns the underlying instant, for the driver to bind as a DATE.
func (d Date) Time() time.Time { return d.t }

// IsZero reports whether the date was never set.
func (d Date) IsZero() bool { return d.t.IsZero() }

// Before reports whether d falls strictly before other.
func (d Date) Before(other Date) bool { return d.t.Before(other.t) }

// Day returns the engine's day offset of this date from a cut-off.
func (d Date) Day(cutoff kernel.CutoffDate) int {
	from, _ := time.Parse(time.DateOnly, cutoff.ISO())
	return int(d.t.Sub(from).Hours() / 24)
}

// Movement is one dated receipt or obligation. The zero value is not valid: New
// is the only way to build one, so no caller can construct a row that the
// database would then have to reject.
type Movement struct {
	ID          string
	CompanyID   string
	Node        string
	Direction   Direction
	DueDate     Date
	Amount      kernel.Money
	SettledAmt  kernel.Money
	Status      Status
	KnownAt     Date
	Source      Source
	SourceRef   string
	Shift       Shift
	Scale       Scale
	Exposure    Exposure
	Provenance  Provenance
	Description string
}

// Draft is what a caller supplies. Every optional field has the same default the
// schema declares, so an interface that knows nothing about shift, scale or
// exposure still produces a valid movement.
type Draft struct {
	CompanyID   string
	Node        string
	Direction   Direction
	DueDate     Date
	Amount      kernel.Money
	SettledAmt  kernel.Money
	Status      Status
	KnownAt     Date
	Source      Source
	SourceRef   string
	Shift       Shift
	Scale       Scale
	Exposure    Exposure
	Provenance  Provenance
	Description string
}

// New validates a draft against every invariant of docs/data-model.md §3 and
// returns the movement, with a fresh ULID as its identity.
//
// `cutoff` is the date the company is observed at: a movement that became
// knowable after it is future information and is refused, because admitting it
// would let the analysis see what the business could not.
func New(d Draft, cutoff kernel.CutoffDate, nodes NodeSet) (Movement, error) {
	m := Movement{
		ID:          NewULID(time.Now()),
		CompanyID:   d.CompanyID,
		Node:        d.Node,
		Direction:   d.Direction,
		DueDate:     d.DueDate,
		Amount:      d.Amount,
		SettledAmt:  d.SettledAmt,
		Status:      orDefault(d.Status, Expected),
		KnownAt:     d.KnownAt,
		Source:      d.Source,
		SourceRef:   d.SourceRef,
		Shift:       orDefault(d.Shift, NoShift),
		Scale:       orDefault(d.Scale, NoScale),
		Exposure:    orDefault(d.Exposure, NoExposure),
		Provenance:  orDefault(d.Provenance, Known),
		Description: d.Description,
	}
	if m.KnownAt.IsZero() {
		// The default the schema cannot express: a fact entered by hand became
		// knowable the day it is dated, never later than the cut-off. That is
		// min(due_date, cutoff) — a receipt dated next month is known today.
		cutoffDate := NewDate(mustParse(cutoff.ISO()))
		m.KnownAt = cutoffDate
		if m.DueDate.Before(cutoffDate) {
			m.KnownAt = m.DueDate
		}
	}
	return m, m.validate(cutoff, nodes)
}

// NodeSet is the reference list of graph nodes a movement may fund or consume.
// It is a set rather than a repository call because the list is fixed: the
// twenty-four rows seeded into `graph_nodes` from engine/graph.py.
type NodeSet map[string]struct{}

// NewNodeSet builds a node set from the identifiers the database holds.
func NewNodeSet(ids []string) NodeSet {
	set := make(NodeSet, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	return set
}

// Has reports whether the node exists. An empty set accepts everything, so a
// caller that has not loaded the reference table does not reject valid input.
func (n NodeSet) Has(id string) bool {
	if len(n) == 0 {
		return true
	}
	_, ok := n[id]
	return ok
}

func (m Movement) validate(cutoff kernel.CutoffDate, nodes NodeSet) error {
	if m.CompanyID == "" {
		return fmt.Errorf("%w: company_id is required", ErrInvalid)
	}
	if m.Node == "" {
		return fmt.Errorf("%w: node is required", ErrInvalid)
	}
	if !nodes.Has(m.Node) {
		return fmt.Errorf("%w: node %q is not one of the graph nodes", ErrInvalid, m.Node)
	}
	if !contains(directions, m.Direction) {
		return fmt.Errorf("%w: direction %q is not one of in, out", ErrInvalid, m.Direction)
	}
	if !contains(statuses, m.Status) {
		return fmt.Errorf("%w: status %q is not one of %v", ErrInvalid, m.Status, statuses)
	}
	if !contains(sources, m.Source) {
		return fmt.Errorf("%w: source %q is not one of %v", ErrInvalid, m.Source, sources)
	}
	if !contains(provenances, m.Provenance) {
		return fmt.Errorf("%w: provenance %q is not one of %v", ErrInvalid, m.Provenance, provenances)
	}
	if !contains(shifts, m.Shift) {
		return fmt.Errorf("%w: shift %q is not one of %v", ErrInvalid, m.Shift, shifts)
	}
	if !contains(scales, m.Scale) {
		return fmt.Errorf("%w: scale %q is not one of %v", ErrInvalid, m.Scale, scales)
	}
	if !contains(exposures, m.Exposure) {
		return fmt.Errorf("%w: exposure %q is not one of %v", ErrInvalid, m.Exposure, exposures)
	}
	if m.DueDate.IsZero() {
		return fmt.Errorf("%w: due_date is required", ErrInvalid)
	}
	if m.Amount < 0 {
		return fmt.Errorf("%w: amount_cents must be zero or more, got %d", ErrInvalid, m.Amount.Cents())
	}
	// The reconciliation CHECK of the schema, enforced before the insert so the
	// error names the field rather than the constraint.
	if m.SettledAmt < 0 || m.SettledAmt > m.Amount {
		return fmt.Errorf("%w: settled_cents must be between 0 and amount_cents (%d), got %d",
			ErrInvalid, m.Amount.Cents(), m.SettledAmt.Cents())
	}
	// movements_settled_consistent: `settled` is exactly a fully reconciled,
	// non-zero movement. `cancelled` is exempt, as the schema says.
	if m.Status != Cancelled {
		fully := m.SettledAmt == m.Amount && m.Amount > 0
		if (m.Status == Settled) != fully {
			return fmt.Errorf(
				"%w: status %q contradicts the reconciliation (settled_cents %d of %d)",
				ErrInvalid, m.Status, m.SettledAmt.Cents(), m.Amount.Cents())
		}
	}
	if m.KnownAt.IsZero() {
		return fmt.Errorf("%w: known_at is required", ErrInvalid)
	}
	// "A movement with known_at > cutoff_date is future information and is
	// rejected" (docs/data-model.md §3).
	if cutoffDate := NewDate(mustParse(cutoff.ISO())); cutoffDate.Before(m.KnownAt) {
		return fmt.Errorf("%w: known_at %s is after the cut-off %s, which would be future information",
			ErrInvalid, m.KnownAt.ISO(), cutoff.ISO())
	}
	return nil
}

// Conflicts reports whether other carries the same external identity as m but a
// different fact. The database can no longer answer this on its own: the dedup
// index had to take `due_date` to satisfy the hypertable, so a re-import under a
// corrected date would insert instead of failing (docs/data-model.md §1).
func (m Movement) Conflicts(other Movement) bool {
	if m.SourceRef == "" || m.SourceRef != other.SourceRef {
		return false
	}
	if m.CompanyID != other.CompanyID || m.Source != other.Source {
		return false
	}
	return m.DueDate.ISO() != other.DueDate.ISO() ||
		m.Amount != other.Amount ||
		m.Direction != other.Direction ||
		m.Node != other.Node
}

// Outstanding is what the movement still moves: the contractual amount less what
// has been reconciled. It is the figure the engine consumes.
func (m Movement) Outstanding() kernel.Money { return m.Amount - m.SettledAmt }

// Open reports whether the movement still affects the cash calendar. A settled
// or cancelled one does not (docs/data-model.md §4).
func (m Movement) Open() bool { return m.Status != Settled && m.Status != Cancelled }

func contains[T comparable](values []T, v T) bool {
	for _, candidate := range values {
		if candidate == v {
			return true
		}
	}
	return false
}

func orDefault[T comparable](v, fallback T) T {
	var zero T
	if v == zero {
		return fallback
	}
	return v
}

func mustParse(iso string) time.Time {
	t, _ := time.Parse(time.DateOnly, iso)
	return t
}
