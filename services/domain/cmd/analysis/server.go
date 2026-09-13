package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	movementsapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/projection"
	riskapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/application"
	scenarioapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// query adapts a URL query string to the scenario context's Query port.
type query url.Values

func (q query) Get(id string) (string, bool) {
	values, ok := url.Values(q)[id]
	if !ok || len(values) == 0 {
		return "", false
	}
	return values[0], true
}

// Server is the HTTP delivery mechanism. It is the composition root's adapter:
// it knows both bounded contexts because someone has to wire them, and it holds
// no business rule of its own.
type Server struct {
	Builder    scenarioapp.Builder
	Analyzer   riskapp.Analyzer
	Companies  riskapp.CompanyRepository
	ActionsRaw json.RawMessage

	// Movements is the ledger context. It is nil when no database is
	// configured, and the two /v1/movements routes then answer 503 rather
	// than pretending to have stored or read anything.
	Movements *movementsapp.Service

	CompanyID    string
	Cutoff       kernel.CutoffDate
	CacheControl string
	Timeout      time.Duration
	Log          *slog.Logger
}

// Routes builds the mux. The paths are the contract of docs/architecture.md §5.4.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/analysis", s.analysis)
	mux.HandleFunc("GET /v1/actions", s.actions)
	mux.HandleFunc("GET /v1/movements", s.listMovements)
	mux.HandleFunc("POST /v1/movements", s.addMovement)
	mux.HandleFunc("GET /health", s.health)
	return s.withCommonHeaders(mux)
}

// withCommonHeaders applies what every response needs: CORS for the static site
// origin, and the correlation id that travels from the edge to Go to Python.
func (s *Server) withCommonHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The API has no users and no authentication (docs/architecture.md §15),
		// so any origin may read it. POST is listed because /v1/movements
		// writes; the same caveat applies to it, and it is the reason that
		// route must not be exposed publicly without authentication.
		w.Header().Set("access-control-allow-origin", "*")
		w.Header().Set("access-control-allow-methods", "GET, POST, OPTIONS")
		w.Header().Set("access-control-allow-headers", "content-type, x-correlation-id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		id := r.Header.Get("x-correlation-id")
		if id == "" {
			id = newCorrelationID()
		}
		w.Header().Set("x-correlation-id", id)
		next.ServeHTTP(w, r.WithContext(engineadapter.WithCorrelationID(r.Context(), id)))
	})
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"}, "no-store")
}

// actions serves contracts/actions.schema.json verbatim. The front-end bundles
// the same file so its form still renders with the network down; this endpoint
// exists so a client can confirm which contract the API is validating against.
func (s *Server) actions(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.Header().Set("cache-control", s.CacheControl)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(s.ActionsRaw)
}

// analysis is GET /v1/analysis. The response is a pure function of the query
// string, which is what makes caching it correct rather than a bug.
func (s *Server) analysis(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	ctx, cancel := context.WithTimeout(r.Context(), s.Timeout)
	defer cancel()

	q := query(r.URL.Query())
	cutoff := s.Cutoff
	if raw, ok := q.Get("cutoff_date"); ok && raw != "" {
		parsed, err := kernel.ParseCutoffDate(raw)
		if err != nil {
			s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
			return
		}
		cutoff = parsed
	}

	scenario, err := s.Builder.Build(q, cutoff)
	if err != nil {
		s.fail(w, r, http.StatusBadRequest, "ParameterError", err)
		return
	}

	companyID := s.CompanyID
	if raw, ok := q.Get("company_id"); ok && raw != "" {
		companyID = raw
	}
	company, err := s.Companies.Profile(ctx, companyID)
	if err != nil {
		s.fail(w, r, http.StatusNotFound, "UnknownCompany", err)
		return
	}

	assessment, err := s.Analyzer.Analyze(ctx, scenario, company)
	if err != nil {
		var engineErr *engineadapter.EngineError
		switch {
		case errors.As(err, &engineErr) && engineErr.IsParameterError():
			s.fail(w, r, http.StatusBadRequest, engineErr.Type, err)
		case errors.Is(err, context.DeadlineExceeded):
			s.fail(w, r, http.StatusGatewayTimeout, "EngineTimeout", err)
		default:
			s.fail(w, r, http.StatusBadGateway, "EngineError", err)
		}
		return
	}

	document := projection.Project(assessment, scenario, company.CompanyID, company.Currency)
	s.Log.Info("analysis",
		"correlation_id", engineadapter.CorrelationID(ctx),
		"state_id", document.StateID,
		"action", string(scenario.Action().Kind()),
		"seed", document.Seed,
		"paths", document.Simulation != nil,
		"duration_ms", time.Since(started).Milliseconds(),
	)
	writeJSON(w, http.StatusOK, document, s.CacheControl)
}

func (s *Server) fail(w http.ResponseWriter, r *http.Request, status int, kind string, err error) {
	s.Log.Warn("request failed",
		"correlation_id", engineadapter.CorrelationID(r.Context()),
		"status", status,
		"error", kind,
		"message", err.Error(),
	)
	// The shape matches what engine/handler.py already returns on a rejected
	// query, so a client sees one error format regardless of which service
	// refused the request.
	writeJSON(w, status, map[string]string{"error": kind, "message": err.Error()}, "no-store")
}

func writeJSON(w http.ResponseWriter, status int, body any, cacheControl string) {
	blob, err := json.Marshal(body)
	if err != nil {
		http.Error(w, `{"error":"EncodingError"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.Header().Set("cache-control", cacheControl)
	w.WriteHeader(status)
	_, _ = w.Write(blob)
}
