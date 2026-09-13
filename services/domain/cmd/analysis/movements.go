package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	movementsapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	movementsdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/domain"
	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// maxBodyBytes caps a movement payload. The largest legitimate body is a few
// hundred bytes; the limit is what stops an unbounded read.
const maxBodyBytes = 16 << 10

// movementJSON is the wire shape of a movement. It is the `movements` table's
// vocabulary with camelCase keys and money in cents, so the interface, the
// contract and the table all name the same thing the same way.
type movementJSON struct {
	ID           string `json:"id"`
	CompanyID    string `json:"companyId"`
	Node         string `json:"node"`
	Direction    string `json:"direction"`
	DueDate      string `json:"dueDate"`
	AmountCents  int64  `json:"amountCents"`
	SettledCents int64  `json:"settledCents"`
	Status       string `json:"status"`
	KnownAt      string `json:"knownAt"`
	Source       string `json:"source"`
	SourceRef    string `json:"sourceRef,omitempty"`
	Shift        string `json:"shift"`
	Scale        string `json:"scale"`
	Exposure     string `json:"exposure"`
	Provenance   string `json:"provenance"`
	Description  string `json:"description,omitempty"`
}

func toJSON(m movementsdomain.Movement) movementJSON {
	return movementJSON{
		ID:           m.ID,
		CompanyID:    m.CompanyID,
		Node:         m.Node,
		Direction:    string(m.Direction),
		DueDate:      m.DueDate.ISO(),
		AmountCents:  m.Amount.Cents(),
		SettledCents: m.SettledAmt.Cents(),
		Status:       string(m.Status),
		KnownAt:      m.KnownAt.ISO(),
		Source:       string(m.Source),
		SourceRef:    m.SourceRef,
		Shift:        string(m.Shift),
		Scale:        string(m.Scale),
		Exposure:     string(m.Exposure),
		Provenance:   string(m.Provenance),
		Description:  m.Description,
	}
}

// movementRequest is what a client posts. Every field the schema defaults is
// optional here, so a caller that knows only the four essentials — node,
// direction, date and amount — still writes a valid row.
type movementRequest struct {
	CompanyID    string `json:"companyId"`
	Node         string `json:"node"`
	Direction    string `json:"direction"`
	DueDate      string `json:"dueDate"`
	AmountCents  *int64 `json:"amountCents"`
	SettledCents *int64 `json:"settledCents"`
	Status       string `json:"status"`
	KnownAt      string `json:"knownAt"`
	Source       string `json:"source"`
	SourceRef    string `json:"sourceRef"`
	Shift        string `json:"shift"`
	Scale        string `json:"scale"`
	Exposure     string `json:"exposure"`
	Provenance   string `json:"provenance"`
	Description  string `json:"description"`
}

// listMovements is GET /v1/movements. Unlike the analysis it is never cached:
// the ledger changes whenever someone records a movement.
func (s *Server) listMovements(w http.ResponseWriter, r *http.Request) {
	if s.Movements == nil {
		s.fail(w, r, http.StatusServiceUnavailable, "StorageUnavailable",
			errors.New("no movements database is configured"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.Timeout)
	defer cancel()

	q := query(r.URL.Query())
	filter := movementsapp.Filter{CompanyID: s.CompanyID}
	if raw, ok := q.Get("company_id"); ok && raw != "" {
		filter.CompanyID = raw
	}
	if raw, ok := q.Get("direction"); ok && raw != "" {
		filter.Direction = movementsdomain.Direction(raw)
	}
	if raw, ok := q.Get("status"); ok && raw != "" {
		filter.Status = []movementsdomain.Status{movementsdomain.Status(raw)}
	}
	for _, bound := range []struct {
		param string
		into  *movementsdomain.Date
	}{{"from", &filter.From}, {"to", &filter.To}} {
		raw, ok := q.Get(bound.param)
		if !ok || raw == "" {
			continue
		}
		parsed, err := movementsdomain.ParseDate(raw)
		if err != nil {
			s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
			return
		}
		*bound.into = parsed
	}
	if raw, ok := q.Get("limit"); ok && raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit <= 0 {
			s.fail(w, r, http.StatusBadRequest, "ParameterError",
				errors.New("limit must be a positive integer"))
			return
		}
		filter.Limit = limit
	}

	movements, err := s.Movements.List(ctx, filter)
	if err != nil {
		s.failMovement(w, r, err)
		return
	}

	items := make([]movementJSON, len(movements))
	for i, m := range movements {
		items[i] = toJSON(m)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"companyId":  filter.CompanyID,
		"cutoffDate": s.Cutoff.ISO(),
		"movements":  items,
	}, "no-store")
}

// addMovement is POST /v1/movements. It answers 201 with the movement as it was
// stored, identity included, so the client renders what the database holds
// rather than what it hoped to send.
func (s *Server) addMovement(w http.ResponseWriter, r *http.Request) {
	if s.Movements == nil {
		s.fail(w, r, http.StatusServiceUnavailable, "StorageUnavailable",
			errors.New("no movements database is configured"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.Timeout)
	defer cancel()

	var body movementRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
		return
	}

	draft, err := s.draftFrom(body)
	if err != nil {
		s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
		return
	}

	stored, err := s.Movements.Add(ctx, draft)
	if err != nil {
		s.failMovement(w, r, err)
		return
	}
	s.Log.Info("movement recorded",
		"correlation_id", engineadapter.CorrelationID(ctx),
		"movement_id", stored.ID,
		"company_id", stored.CompanyID,
		"node", stored.Node,
		"direction", string(stored.Direction),
		"due_date", stored.DueDate.ISO(),
	)
	writeJSON(w, http.StatusCreated, toJSON(stored), "no-store")
}

func (s *Server) draftFrom(body movementRequest) (movementsdomain.Draft, error) {
	draft := movementsdomain.Draft{
		CompanyID:   body.CompanyID,
		Node:        body.Node,
		Direction:   movementsdomain.Direction(body.Direction),
		Status:      movementsdomain.Status(body.Status),
		Source:      movementsdomain.Source(body.Source),
		SourceRef:   body.SourceRef,
		Shift:       movementsdomain.Shift(body.Shift),
		Scale:       movementsdomain.Scale(body.Scale),
		Exposure:    movementsdomain.Exposure(body.Exposure),
		Provenance:  movementsdomain.Provenance(body.Provenance),
		Description: body.Description,
	}
	if draft.CompanyID == "" {
		draft.CompanyID = s.CompanyID
	}
	if draft.Source == "" {
		// A movement arriving over HTTP with no stated origin was typed by a
		// person; that is exactly what `manual` means in the schema.
		draft.Source = movementsdomain.Manual
	}
	if body.AmountCents == nil {
		return draft, errors.New("amountCents is required")
	}
	draft.Amount = kernel.Money(*body.AmountCents)
	if body.SettledCents != nil {
		draft.SettledAmt = kernel.Money(*body.SettledCents)
	}
	due, err := movementsdomain.ParseDate(body.DueDate)
	if err != nil {
		return draft, err
	}
	draft.DueDate = due
	if body.KnownAt != "" {
		known, err := movementsdomain.ParseDate(body.KnownAt)
		if err != nil {
			return draft, err
		}
		draft.KnownAt = known
	}
	return draft, nil
}

// failMovement maps the use case's error classes onto status codes: a rejected
// draft is the caller's (400), a conflicting re-import is a collision with a
// recorded fact (409), and anything else is the database failing (503).
func (s *Server) failMovement(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, movementsdomain.ErrInvalid):
		s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
	case errors.Is(err, movementsapp.ErrConflict):
		s.fail(w, r, http.StatusConflict, "ConflictingImport", err)
	case errors.Is(err, context.DeadlineExceeded):
		s.fail(w, r, http.StatusGatewayTimeout, "StorageTimeout", err)
	default:
		s.fail(w, r, http.StatusServiceUnavailable, "StorageError", err)
	}
}
