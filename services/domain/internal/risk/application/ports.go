// Package application holds the risk context's use cases and the ports they
// depend on. Adapters implement the ports; the dependency is inverted so the
// domain never reaches for infrastructure.
package application

import (
	"context"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Engine is the port over the Python computation. Its signature speaks the
// domain's language in both directions: a committed Scenario and a company
// profile go in, an Assessment comes out. NumPy vocabulary — worlds, paths,
// arrays, breaking points — never crosses it; translating it away is the
// adapter's whole job.
type Engine interface {
	Run(ctx context.Context, s scenariodomain.Scenario, c kernel.Company) (riskdomain.Assessment, error)
}

// CompanyRepository yields the profile the analysis runs on. In the MVP there is
// one demo company and no database (docs/architecture.md decision 10); the port
// exists so adding `company_snapshots` later changes an adapter, not a use case.
type CompanyRepository interface {
	Profile(ctx context.Context, companyID string) (kernel.Company, error)
}
