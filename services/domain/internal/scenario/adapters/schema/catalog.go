// Package schema implements the ActionCatalog port over
// contracts/actions.schema.json.
//
// The contract is read, never restated: no bound, default or step is duplicated
// in Go. Adding a decision means adding a schema entry and, if it has invariants
// the schema cannot express, a case in domain.action.Validate — no change here.
package schema

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
)

// FileName is the contract this catalogue is built from.
const FileName = "actions.schema.json"

type parameter struct {
	ID    string       `json:"id"`
	Label string       `json:"label"`
	Type  string       `json:"type"`
	Min   *json.Number `json:"min"`
	Max   *json.Number `json:"max"`
	// Default is kept as the raw token because the contract's defaults are not
	// all of one type: a boolean control declares `true`, a slider declares a
	// number, and forcing either into the other loses the contract's meaning.
	Default json.RawMessage `json:"default"`
}

type actionSpec struct {
	Label      string      `json:"label"`
	Default    bool        `json:"default"`
	Hint       string      `json:"hint"`
	Parameters []parameter `json:"parameters"`
}

type document struct {
	Schema  string                `json:"schema"`
	Actions map[string]actionSpec `json:"actions"`
	Stress  actionSpec            `json:"stress"`
	Run     actionSpec            `json:"run"`
}

// Catalog is the loaded contract.
type Catalog struct {
	doc document
	raw json.RawMessage
}

// Load reads actions.schema.json from a contracts directory.
func Load(contractsDir string) (*Catalog, error) {
	path := filepath.Join(contractsDir, FileName)
	blob, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	return Parse(blob)
}

// Parse builds a catalogue from the contract's bytes.
func Parse(blob []byte) (*Catalog, error) {
	var doc document
	if err := json.Unmarshal(blob, &doc); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", FileName, err)
	}
	if doc.Schema != "actions/v1" {
		return nil, fmt.Errorf("unsupported action schema %q, want actions/v1", doc.Schema)
	}
	if len(doc.Actions) == 0 {
		return nil, fmt.Errorf("%s declares no actions", FileName)
	}
	return &Catalog{doc: doc, raw: json.RawMessage(blob)}, nil
}

// Raw returns the contract verbatim, for serving it to the front-end.
func (c *Catalog) Raw() json.RawMessage { return c.raw }

// Kind resolves a raw action id against the set the schema declares, then
// against the domain's closed set. Both must agree, so a schema that grew a
// decision the domain does not know is a visible failure rather than a silent
// pass-through.
func (c *Catalog) Kind(raw string) (domain.ActionKind, error) {
	if _, ok := c.doc.Actions[raw]; !ok {
		return "", fmt.Errorf("unknown action: %s", raw)
	}
	return domain.ParseActionKind(raw)
}

// Parameters coerces one decision's parameters, filling in schema defaults.
func (c *Catalog) Parameters(kind domain.ActionKind, q application.Query) (map[string]any, error) {
	spec, ok := c.doc.Actions[string(kind)]
	if !ok {
		return nil, fmt.Errorf("unknown action: %s", kind)
	}
	return coerceAll(spec.Parameters, q)
}

// Stress coerces the three stress controls of PRD §3.2, block 3.
func (c *Catalog) Stress(q application.Query) (domain.Stress, error) {
	values, err := coerceAll(c.doc.Stress.Parameters, q)
	if err != nil {
		return domain.Stress{}, err
	}
	delay, err := asInt(values, "collection_delay_days")
	if err != nil {
		return domain.Stress{}, err
	}
	injection, err := asInt(values, "capital_injection_cents")
	if err != nil {
		return domain.Stress{}, err
	}
	lost, _ := values["main_customer_lost"].(bool)
	return domain.Stress{
		CollectionDelayDays:   int(delay),
		MainCustomerLost:      lost,
		CapitalInjectionCents: injection,
	}, nil
}

// Run coerces paths, seed and horizon_days.
func (c *Catalog) Run(q application.Query) (application.Run, error) {
	values, err := coerceAll(c.doc.Run.Parameters, q)
	if err != nil {
		return application.Run{}, err
	}
	paths, err := asInt(values, "paths")
	if err != nil {
		return application.Run{}, err
	}
	seed, err := asInt(values, "seed")
	if err != nil {
		return application.Run{}, err
	}
	horizon, err := asInt(values, "horizon_days")
	if err != nil {
		return application.Run{}, err
	}
	return application.Run{Paths: int(paths), Seed: int(seed), HorizonDays: int(horizon)}, nil
}

func asInt(values map[string]any, id string) (int64, error) {
	v, ok := values[id]
	if !ok {
		return 0, fmt.Errorf("%s: missing from the action schema", id)
	}
	n, ok := v.(int64)
	if !ok {
		return 0, fmt.Errorf("%s: declared as %T, want an integer", id, v)
	}
	return n, nil
}

func coerceAll(specs []parameter, q application.Query) (map[string]any, error) {
	out := make(map[string]any, len(specs))
	for _, spec := range specs {
		raw, present := q.Get(spec.ID)
		value, err := coerce(spec, raw, present)
		if err != nil {
			return nil, err
		}
		out[spec.ID] = value
	}
	return out, nil
}

// coerce reproduces engine/contracts.py:_coerce: an absent or empty value takes
// the schema default, the declared type drives the parse, and the declared
// bounds are enforced on the parsed value.
func coerce(spec parameter, raw string, present bool) (any, error) {
	if !present || raw == "" {
		return defaultValue(spec)
	}
	switch spec.Type {
	case "money", "days", "integer":
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("%s: %q is not a valid %s", spec.ID, raw, spec.Type)
		}
		return n, boundsCheck(spec, float64(n), formatNumber(float64(n), true))
	case "percentage":
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
			return nil, fmt.Errorf("%s: %q is not a valid %s", spec.ID, raw, spec.Type)
		}
		return f, boundsCheck(spec, f, formatNumber(f, false))
	case "boolean":
		switch strings.ToLower(raw) {
		case "true", "1":
			return true, nil
		case "false", "0":
			return false, nil
		default:
			return nil, fmt.Errorf("%s: %q is not a valid boolean", spec.ID, raw)
		}
	default:
		return raw, nil
	}
}

// defaultValue decodes the schema default in the parameter's declared type. A
// parameter with no declared default is a contract error, not something to
// paper over with a zero.
func defaultValue(spec parameter) (any, error) {
	if spec.Type == "boolean" {
		if len(spec.Default) == 0 {
			return false, nil
		}
		var b bool
		if err := json.Unmarshal(spec.Default, &b); err != nil {
			return nil, fmt.Errorf("%s: default %s is not a boolean", spec.ID, spec.Default)
		}
		return b, nil
	}
	if len(spec.Default) == 0 {
		return nil, fmt.Errorf("%s: the action schema declares no default", spec.ID)
	}
	switch spec.Type {
	case "money", "days", "integer":
		var n int64
		if err := json.Unmarshal(spec.Default, &n); err != nil {
			return nil, fmt.Errorf("%s: default %s is not an integer", spec.ID, spec.Default)
		}
		return n, nil
	case "percentage":
		var f float64
		if err := json.Unmarshal(spec.Default, &f); err != nil {
			return nil, fmt.Errorf("%s: default %s is not a number", spec.ID, spec.Default)
		}
		return f, nil
	default:
		var s string
		if err := json.Unmarshal(spec.Default, &s); err != nil {
			return nil, fmt.Errorf("%s: default %s is not a string", spec.ID, spec.Default)
		}
		return s, nil
	}
}

// boundsCheck enforces the min and max the schema declares, reporting the bounds
// with the exact tokens the contract uses.
func boundsCheck(spec parameter, value float64, shown string) error {
	below := false
	if spec.Min != nil {
		if min, err := spec.Min.Float64(); err == nil && value < min {
			below = true
		}
	}
	above := false
	if spec.Max != nil {
		if max, err := spec.Max.Float64(); err == nil && value > max {
			above = true
		}
	}
	if !below && !above {
		return nil
	}
	return fmt.Errorf("%s: %s outside [%s, %s]",
		spec.ID, shown, token(spec.Min), token(spec.Max))
}

func token(n *json.Number) string {
	if n == nil {
		return "None"
	}
	return n.String()
}

// formatNumber renders a value the way the engine's error message does: an
// integer plainly, a float with at least one decimal.
func formatNumber(v float64, integral bool) string {
	if integral {
		return strconv.FormatInt(int64(v), 10)
	}
	if v == math.Trunc(v) && math.Abs(v) < 1e15 {
		return strconv.FormatFloat(v, 'f', 1, 64)
	}
	return strconv.FormatFloat(v, 'g', -1, 64)
}
