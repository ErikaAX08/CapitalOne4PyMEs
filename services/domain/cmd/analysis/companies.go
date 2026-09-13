package main

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	companyadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/company"
)

// listCompanies is GET /v1/companies. It exists so a person can choose which
// company to analyse: without it the interface can only ever show the one the
// service serves by default.
//
// Like the ledger and unlike the analysis, it is never cached — the catalogue
// changes whenever a company is added.
func (s *Server) listCompanies(w http.ResponseWriter, r *http.Request) {
	if s.Catalog == nil {
		s.fail(w, r, http.StatusServiceUnavailable, "StorageUnavailable",
			errors.New("no company database is configured"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.Timeout)
	defer cancel()

	q := query(r.URL.Query())
	request := companyadapter.CatalogQuery{}
	if raw, ok := q.Get("q"); ok {
		request.Search = raw
	}
	switch outcome, _ := q.Get("outcome"); outcome {
	case "bankrupt":
		request.OnlyBankrupt = true
	case "survivor":
		request.OnlySurvivors = true
	case "", "all":
	default:
		s.fail(w, r, http.StatusBadRequest, "ParameterError",
			errors.New("outcome: want bankrupt, survivor or all"))
		return
	}
	for _, bound := range []struct {
		param string
		into  *int
	}{{"limit", &request.Limit}, {"offset", &request.Offset}} {
		raw, ok := q.Get(bound.param)
		if !ok || raw == "" {
			continue
		}
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 {
			s.fail(w, r, http.StatusBadRequest, "ParameterError",
				errors.New(bound.param+": want a non-negative integer"))
			return
		}
		*bound.into = value
	}

	companies, err := s.Catalog.Catalog(ctx, request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			s.fail(w, r, http.StatusGatewayTimeout, "StorageTimeout", err)
			return
		}
		s.fail(w, r, http.StatusServiceUnavailable, "StorageError", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"cutoffDate":     s.Cutoff.ISO(),
		"defaultCompany": s.CompanyID,
		"companies":      companies,
	}, "no-store")
}
