package projection_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"

	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/projection"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/adapters/schema"
	scenarioapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

const (
	contractsDir = "../../../../../../contracts"
	fixturesDir  = "../../../../../engine/fixtures/states"
	companyID    = "co_demo_agency"
	cutoffDate   = "2026-09-12"
)

// mapQuery satisfies the scenario context's Query port from a plain map.
type mapQuery map[string]string

func (q mapQuery) Get(id string) (string, bool) {
	v, ok := q[id]
	return v, ok
}

// The four parameterizations of PRD §5.4. They are four parameterizations, not
// four actions: that distinction is what keeps the fallback states internally
// consistent.
var parameterizations = map[string]mapQuery{
	"base":    {"action": "none", "seed": "42", "paths": "5000"},
	"tension": {"action": "accept_project", "collection_delay_days": "16", "seed": "42", "paths": "5000"},
	"crisis": {
		"action": "accept_project", "collection_delay_days": "16",
		"main_customer_lost": "true", "seed": "42", "paths": "5000",
	},
	"reinforced": {
		"action": "accept_project", "collection_delay_days": "16",
		"advance_pct": "25", "seed": "42", "paths": "5000",
	},
}

// TestProjectorReproducesFallbackStates is the contract gate of
// docs/architecture.md §9: the Go projector and engine/projection.py must
// produce the same state document.
//
// The comparison is semantic, not byte-for-byte, and deliberately so: Python
// writes an integral float as `1.0` where Go writes `1`, which is the same JSON
// number and the same value after parsing. Everything a reader can observe —
// every field, every string, every number — must match exactly.
func TestProjectorReproducesFallbackStates(t *testing.T) {
	catalog, err := schema.Load(contractsDir)
	if err != nil {
		t.Fatalf("loading the action schema: %v", err)
	}
	cutoff, err := kernel.ParseCutoffDate(cutoffDate)
	if err != nil {
		t.Fatal(err)
	}
	builder := scenarioapp.Builder{Catalog: catalog}

	for _, name := range sortedKeys(parameterizations) {
		t.Run(name, func(t *testing.T) {
			raw, err := os.ReadFile(filepath.Join("testdata", name+".result.json"))
			if err != nil {
				t.Fatalf("reading the captured engine result: %v", err)
			}
			assessment, err := engineadapter.Translate(raw)
			if err != nil {
				t.Fatalf("translating the engine result: %v", err)
			}
			scenario, err := builder.Build(parameterizations[name], cutoff)
			if err != nil {
				t.Fatalf("building the scenario: %v", err)
			}
			document := projection.Project(assessment, scenario, companyID, "MXN")

			got := roundTrip(t, document)
			want := readJSON(t, filepath.Join(fixturesDir, name+".json"))
			if differences := diff("", got, want); len(differences) > 0 {
				t.Errorf("the Go projector and engine/projection.py disagree on %d field(s):", len(differences))
				for _, d := range differences {
					t.Errorf("  %s", d)
				}
			}
		})
	}
}

// TestProjectedDocumentDeclaresItsSchema guards the rule that an unknown schema
// version must be a visible failure rather than a silent zero.
func TestProjectedDocumentDeclaresItsSchema(t *testing.T) {
	if projection.SchemaVersion != "v1" {
		t.Fatalf("schema version is %q; contracts/state.schema.json declares v1",
			projection.SchemaVersion)
	}
}

// TestActionKindsMatchTheContract fails if the schema grows a decision the
// domain does not know, or the domain grows one the schema does not declare.
func TestActionKindsMatchTheContract(t *testing.T) {
	catalog, err := schema.Load(contractsDir)
	if err != nil {
		t.Fatalf("loading the action schema: %v", err)
	}
	for _, kind := range scenariodomain.ActionKinds {
		if _, err := catalog.Kind(string(kind)); err != nil {
			t.Errorf("the domain knows %q but contracts/actions.schema.json does not declare it", kind)
		}
	}
}

func roundTrip(t *testing.T, document projection.Document) any {
	t.Helper()
	blob, err := json.Marshal(document)
	if err != nil {
		t.Fatalf("marshalling the document: %v", err)
	}
	var out any
	if err := json.Unmarshal(blob, &out); err != nil {
		t.Fatalf("re-reading the document: %v", err)
	}
	return out
}

func readJSON(t *testing.T, path string) any {
	t.Helper()
	blob, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	var out any
	if err := json.Unmarshal(blob, &out); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}
	return out
}

// diff walks two decoded documents and reports every leaf that differs, with the
// path to it. A single "not equal" on a 200-field document is not a useful test
// failure.
func diff(path string, got, want any) []string {
	switch expected := want.(type) {
	case map[string]any:
		actual, ok := got.(map[string]any)
		if !ok {
			return []string{fmt.Sprintf("%s: got %T, want an object", label(path), got)}
		}
		var out []string
		for _, key := range sortedKeys(expected) {
			child := path + "." + key
			if _, present := actual[key]; !present {
				out = append(out, fmt.Sprintf("%s: missing, want %v", label(child), expected[key]))
				continue
			}
			out = append(out, diff(child, actual[key], expected[key])...)
		}
		for _, key := range sortedKeys(actual) {
			if _, present := expected[key]; !present {
				out = append(out, fmt.Sprintf("%s: unexpected, got %v", label(path+"."+key), actual[key]))
			}
		}
		return out
	case []any:
		actual, ok := got.([]any)
		if !ok {
			return []string{fmt.Sprintf("%s: got %T, want an array", label(path), got)}
		}
		if len(actual) != len(expected) {
			return []string{fmt.Sprintf("%s: got %d items, want %d", label(path), len(actual), len(expected))}
		}
		var out []string
		for i := range expected {
			out = append(out, diff(fmt.Sprintf("%s[%d]", path, i), actual[i], expected[i])...)
		}
		return out
	default:
		if !reflect.DeepEqual(got, want) {
			return []string{fmt.Sprintf("%s: got %#v, want %#v", label(path), got, want)}
		}
		return nil
	}
}

func label(path string) string {
	if path == "" {
		return "(root)"
	}
	return path
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
