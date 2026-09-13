// Package company implements the risk context's CompanyRepository port.
//
// The MVP deploys no database (docs/architecture.md decision 10), so the profile
// is a JSON fixture whose shape is exactly the `company` block of
// contracts/engine-request.schema.json — which docs/data-model.md §4 defines as
// a projection of `companies`, `company_snapshots` and `recurring_rules`.
// Replacing this adapter with a database one changes nothing above it.
package company

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// FixtureRepository serves one company profile read from disk at start-up.
type FixtureRepository struct {
	profile kernel.Company
}

// LoadFixture reads a company profile and validates it before it can be used.
func LoadFixture(path string) (*FixtureRepository, error) {
	blob, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading the company profile: %w", err)
	}
	var profile kernel.Company
	decoder := json.NewDecoder(bytes.NewReader(blob))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&profile); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}
	if err := profile.Validate(); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return &FixtureRepository{profile: profile}, nil
}

// Profile returns the demo company. The MVP serves exactly one, and asking for a
// different id is a bug rather than an empty result.
func (r *FixtureRepository) Profile(_ context.Context, companyID string) (kernel.Company, error) {
	if companyID != "" && companyID != r.profile.CompanyID {
		return kernel.Company{}, fmt.Errorf("%w: %s", ErrNotFound, companyID)
	}
	return r.profile, nil
}

// DefaultCompanyID is the profile this repository serves.
func (r *FixtureRepository) DefaultCompanyID() string { return r.profile.CompanyID }
