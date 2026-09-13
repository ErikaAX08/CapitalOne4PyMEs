// Package engine is the anti-corruption layer over the Python engine.
//
// It owns three things and nothing else: building the engine request from a
// committed scenario, carrying it over a transport, and translating the result
// into domain objects. NumPy vocabulary does not cross out of this package.
package engine

import (
	"encoding/json"

	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// RequestSchema is the version this adapter speaks. An unknown version is a
// visible failure, never a silent zero.
const RequestSchema = "engine-request/v1"

// request is contracts/engine-request.schema.json. Field names and types are the
// contract's, not Go's conveniences.
type request struct {
	Schema        string         `json:"schema"`
	CutoffDate    string         `json:"cutoff_date"`
	CorrelationID string         `json:"correlation_id,omitempty"`
	Company       kernel.Company `json:"company"`
	Action        requestAction  `json:"action"`
	Stress        requestStress  `json:"stress"`
	Paths         int            `json:"paths"`
	Seed          int            `json:"seed"`
	HorizonDays   int            `json:"horizon_days"`
}

type requestAction struct {
	Kind       string         `json:"kind"`
	Parameters map[string]any `json:"parameters"`
}

type requestStress struct {
	CollectionDelayDays   int   `json:"collection_delay_days"`
	MainCustomerLost      bool  `json:"main_customer_lost"`
	CapitalInjectionCents int64 `json:"capital_injection_cents"`
}

// buildRequest projects a committed scenario and a company profile onto the
// engine request contract.
func buildRequest(
	s scenariodomain.Scenario,
	c kernel.Company,
	correlationID string,
) ([]byte, error) {
	req := request{
		Schema:        RequestSchema,
		CutoffDate:    s.Cutoff().ISO(),
		CorrelationID: correlationID,
		Company:       c,
		Action: requestAction{
			Kind:       string(s.Action().Kind()),
			Parameters: s.Action().Parameters(),
		},
		Stress: requestStress{
			CollectionDelayDays:   s.Stress().CollectionDelayDays,
			MainCustomerLost:      s.Stress().MainCustomerLost,
			CapitalInjectionCents: s.Stress().CapitalInjectionCents,
		},
		Paths:       s.Paths(),
		Seed:        s.Seed().Int(),
		HorizonDays: s.Horizon().Days(),
	}
	return json.Marshal(req)
}
