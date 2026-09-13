// Package postgres implements the movements Repository against PostgreSQL.
//
// The target is Tiger Cloud, which is PostgreSQL with the TimescaleDB
// extension, so nothing here is Timescale-specific: `movements` being a
// hypertable changes how it is partitioned, not how it is queried. Everything
// else in the system stays on AWS (docs/architecture.md §3).
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// defaultLimit caps a listing that did not ask for a size. A ledger view reads
// the recent past, not the entire history.
const defaultLimit = 200

// columns is the projection every read shares, in the order scan expects.
//
// The two CHAR(26) identifiers are trimmed on the way out. CHAR is blank-padded
// in PostgreSQL, and while docs/data-model.md §1 says identifiers are ULIDs —
// which are exactly 26 characters and so pad to nothing — the demo company is
// `co_demo_agency`, which is not one. Reading it back with twelve trailing
// spaces would make it compare unequal to the identifier every other part of
// the system uses.
const columns = `rtrim(movement_id), rtrim(company_id), node, direction, due_date, amount_cents,
	settled_cents, status, known_at, source, coalesce(source_ref, ''),
	shift, scale, exposure, provenance, coalesce(description, '')`

// Repository reads and writes the `movements` table.
type Repository struct{ Pool *pgxpool.Pool }

// Open builds the connection pool. A malformed connection string fails here,
// because no amount of retrying fixes it.
//
// It does not require the database to be reachable. pgxpool connects lazily and
// reconnects on its own, so a database that is briefly unavailable — a cold
// start on a shared instance, a moment of bad network — heals by itself on the
// next request. Refusing to start in that case would take down the routes that
// need no database at all, which is the opposite of how the rest of this system
// behaves when a dependency is slow (PRD 5.5).
//
// Call Probe to find out whether it is actually reachable right now.
func Open(ctx context.Context, dsn string) (*Repository, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("movements: the connection string is not valid: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("movements: cannot create the connection pool: %w", err)
	}
	return &Repository{Pool: pool}, nil
}

// Probe reports whether the database answers right now. A failure is worth
// logging, not worth aborting on.
func (r *Repository) Probe(ctx context.Context) error {
	if err := r.Pool.Ping(ctx); err != nil {
		return fmt.Errorf("movements: cannot reach the database: %w", err)
	}
	return nil
}

// Close releases the pool.
func (r *Repository) Close() {
	if r.Pool != nil {
		r.Pool.Close()
	}
}

// List returns the company's movements, most recent obligation first.
func (r *Repository) List(ctx context.Context, f application.Filter) ([]domain.Movement, error) {
	query := `SELECT ` + columns + ` FROM movements WHERE company_id = $1`
	args := []any{f.CompanyID}

	if f.Direction != "" {
		args = append(args, string(f.Direction))
		query += fmt.Sprintf(" AND direction = $%d", len(args))
	}
	if len(f.Status) > 0 {
		statuses := make([]string, len(f.Status))
		for i, s := range f.Status {
			statuses[i] = string(s)
		}
		args = append(args, statuses)
		query += fmt.Sprintf(" AND status = ANY($%d)", len(args))
	}
	if !f.From.IsZero() {
		args = append(args, f.From.Time())
		query += fmt.Sprintf(" AND due_date >= $%d", len(args))
	}
	if !f.To.IsZero() {
		args = append(args, f.To.Time())
		query += fmt.Sprintf(" AND due_date <= $%d", len(args))
	}

	limit := f.Limit
	if limit <= 0 {
		limit = defaultLimit
	}
	args = append(args, limit)
	// due_date leads the sort because it is the partition column: ordering by
	// it lets the planner walk chunks in order instead of sorting the lot.
	query += fmt.Sprintf(" ORDER BY due_date DESC, movement_id DESC LIMIT $%d", len(args))

	rows, err := r.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("movements: cannot list: %w", err)
	}
	return scan(rows)
}

// BySourceRef yields the movements already carrying this external identity.
func (r *Repository) BySourceRef(ctx context.Context, companyID string, source domain.Source, ref string) ([]domain.Movement, error) {
	if ref == "" {
		return nil, nil
	}
	rows, err := r.Pool.Query(ctx,
		`SELECT `+columns+` FROM movements
		 WHERE company_id = $1 AND source = $2 AND source_ref = $3`,
		companyID, string(source), ref)
	if err != nil {
		return nil, fmt.Errorf("movements: cannot read by source reference: %w", err)
	}
	return scan(rows)
}

// Add inserts one movement. Every CHECK the schema declares has already been
// verified by the domain, so a constraint violation here means the two have
// drifted apart — it is reported as such rather than as a generic failure.
func (r *Repository) Add(ctx context.Context, m domain.Movement) error {
	_, err := r.Pool.Exec(ctx,
		`INSERT INTO movements (
			movement_id, company_id, node, direction, due_date, amount_cents,
			settled_cents, status, known_at, source, source_ref,
			shift, scale, exposure, provenance, description)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, nullif($11, ''), $12, $13, $14, $15, nullif($16, ''))`,
		m.ID, m.CompanyID, m.Node, string(m.Direction), m.DueDate.Time(), m.Amount.Cents(),
		m.SettledAmt.Cents(), string(m.Status), m.KnownAt.Time(), string(m.Source), m.SourceRef,
		string(m.Shift), string(m.Scale), string(m.Exposure), string(m.Provenance), m.Description)

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation: the dedup index rejected an exact duplicate
			return fmt.Errorf("%w: %s/%s is already recorded for this date",
				application.ErrConflict, m.Source, m.SourceRef)
		case "23514", "23503": // check_violation, foreign_key_violation
			return fmt.Errorf("%w: the database refused the movement (%s): %s",
				domain.ErrInvalid, pgErr.ConstraintName, pgErr.Message)
		}
	}
	if err != nil {
		return fmt.Errorf("movements: cannot insert: %w", err)
	}
	return nil
}

// Nodes yields the reference list of graph nodes.
func (r *Repository) Nodes(ctx context.Context) ([]string, error) {
	rows, err := r.Pool.Query(ctx, `SELECT node_id FROM graph_nodes ORDER BY node_id`)
	if err != nil {
		return nil, fmt.Errorf("movements: cannot read the graph nodes: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("movements: cannot read a graph node: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func scan(rows pgx.Rows) ([]domain.Movement, error) {
	defer rows.Close()

	movements := []domain.Movement{}
	for rows.Next() {
		var (
			m                        domain.Movement
			direction, status        string
			source, provenance       string
			shift, scale, exposure   string
			dueDate, knownAt         time.Time
			amountCents, settledCent int64
		)
		if err := rows.Scan(
			&m.ID, &m.CompanyID, &m.Node, &direction, &dueDate, &amountCents,
			&settledCent, &status, &knownAt, &source, &m.SourceRef,
			&shift, &scale, &exposure, &provenance, &m.Description,
		); err != nil {
			return nil, fmt.Errorf("movements: cannot read a row: %w", err)
		}
		m.Direction = domain.Direction(direction)
		m.DueDate = domain.NewDate(dueDate)
		m.Amount = kernel.Money(amountCents)
		m.SettledAmt = kernel.Money(settledCent)
		m.Status = domain.Status(status)
		m.KnownAt = domain.NewDate(knownAt)
		m.Source = domain.Source(source)
		m.Shift = domain.Shift(shift)
		m.Scale = domain.Scale(scale)
		m.Exposure = domain.Exposure(exposure)
		m.Provenance = domain.Provenance(provenance)
		movements = append(movements, m)
	}
	return movements, rows.Err()
}
