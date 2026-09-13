package engine

import (
	"context"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Client implements the risk context's Engine port over a Transport.
type Client struct {
	Transport Transport
}

// NewClient wires a transport into the port.
func NewClient(t Transport) Client { return Client{Transport: t} }

// Run builds the engine request, carries it, and translates the result. It is
// the only path from a Scenario to an Assessment.
func (c Client) Run(
	ctx context.Context,
	s scenariodomain.Scenario,
	company kernel.Company,
) (riskdomain.Assessment, error) {
	payload, err := buildRequest(s, company, CorrelationID(ctx))
	if err != nil {
		return riskdomain.Assessment{}, err
	}
	raw, err := c.Transport.Invoke(ctx, payload)
	if err != nil {
		return riskdomain.Assessment{}, err
	}
	return Translate(raw)
}
