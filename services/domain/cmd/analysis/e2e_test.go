package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
	"time"

	companyadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/company"
	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	riskapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/adapters/schema"
	scenarioapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

const (
	contractsDir = "../../../../contracts"
	engineDir    = "../../../engine"
	fixturesDir  = "../../../engine/fixtures/states"
)

// start wires the real service — real contract, real company profile, real
// Python engine — and serves it over a test HTTP server. This is the whole path
// of docs/architecture.md §4.1 minus the CDN and API Gateway.
func start(t *testing.T) *httptest.Server {
	t.Helper()
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("python3 is not installed; the end-to-end path needs the engine")
	}
	probe := exec.Command("python3", "-c", "import numpy")
	probe.Dir = engineDir
	if err := probe.Run(); err != nil {
		t.Skip("numpy is not installed; run `pip install -e services/engine[dev]`")
	}

	catalog, err := schema.Load(contractsDir)
	if err != nil {
		t.Fatal(err)
	}
	companies, err := companyadapter.LoadFixture(
		filepath.Join(engineDir, "fixtures", "company_demo_agency.json"))
	if err != nil {
		t.Fatal(err)
	}
	cutoff, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	transport, err := engineadapter.NewLocalTransport("python3", engineDir, log)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = transport.Close() })

	server := &Server{
		Builder:      scenarioapp.Builder{Catalog: catalog},
		Analyzer:     riskapp.Analyzer{Engine: engineadapter.NewClient(transport)},
		Companies:    companies,
		ActionsRaw:   catalog.Raw(),
		CompanyID:    companies.DefaultCompanyID(),
		Cutoff:       cutoff,
		CacheControl: "public, max-age=3600",
		Timeout:      60 * time.Second,
		Log:          log,
	}
	httpServer := httptest.NewServer(server.Routes())
	t.Cleanup(httpServer.Close)
	return httpServer
}

// TestAnalysisReproducesTheFallbackStates is the end-to-end contract gate: the
// four parameterizations of PRD §5.4, requested over HTTP and answered by the
// live engine, must equal the documents engine/scripts/generate_states.py wrote.
//
// It is what makes the degradation of PRD §5.5 honest. The front-end falls back
// to those files when the network fails, and it may only do so if the API would
// have returned the same thing.
func TestAnalysisReproducesTheFallbackStates(t *testing.T) {
	server := start(t)
	cases := map[string]string{
		"base":       "action=none&seed=42&paths=5000",
		"tension":    "action=accept_project&collection_delay_days=16&seed=42&paths=5000",
		"crisis":     "action=accept_project&collection_delay_days=16&main_customer_lost=true&seed=42&paths=5000",
		"reinforced": "action=accept_project&collection_delay_days=16&advance_pct=25&seed=42&paths=5000",
	}
	for _, name := range sortedKeys(cases) {
		t.Run(name, func(t *testing.T) {
			got, status := getJSON(t, server.URL+"/v1/analysis?"+cases[name])
			if status != http.StatusOK {
				t.Fatalf("status %d, want 200; body %v", status, got)
			}
			want := readJSON(t, filepath.Join(fixturesDir, name+".json"))
			if differences := diff("", got, want); len(differences) > 0 {
				t.Errorf("the API and %s.json disagree on %d field(s):", name, len(differences))
				for _, d := range differences {
					t.Errorf("  %s", d)
				}
			}
		})
	}
}

// TestArbitraryParametersAreComputedLive covers the principle the architecture
// rests on: the user enters their own numbers and the engine runs on them, so a
// different revenue must produce a different document rather than the nearest
// prepared case.
func TestArbitraryParametersAreComputedLive(t *testing.T) {
	server := start(t)
	base, _ := getJSON(t, server.URL+
		"/v1/analysis?action=accept_project&total_revenue_cents=80000000&seed=42&paths=1000")
	larger, _ := getJSON(t, server.URL+
		"/v1/analysis?action=accept_project&total_revenue_cents=120000000&seed=42&paths=1000")
	if reflect.DeepEqual(base, larger) {
		t.Fatal("a $1,200,000 project returned the same document as an $800,000 one")
	}
	echo := larger.(map[string]any)["parameterization"].(map[string]any)
	if echo["total_revenue_cents"] != float64(120000000) {
		t.Errorf("parameterization echoes %v, want the revenue that was requested",
			echo["total_revenue_cents"])
	}
}

// TestDeterminism is what makes the response cacheable: the same query must
// return the same document, byte for byte.
func TestDeterminism(t *testing.T) {
	server := start(t)
	url := server.URL + "/v1/analysis?action=accept_project&collection_delay_days=16&seed=42&paths=1000"
	first := getRaw(t, url)
	second := getRaw(t, url)
	if first != second {
		t.Fatal("the same query returned two different documents; the CloudFront cache key would be a lie")
	}
}

func TestOutOfRangeParameterIsRejected(t *testing.T) {
	server := start(t)
	body, status := getJSON(t, server.URL+"/v1/analysis?action=accept_project&advance_pct=95")
	if status != http.StatusBadRequest {
		t.Fatalf("status %d, want 400 for an advance above the declared maximum", status)
	}
	message := body.(map[string]any)["message"].(string)
	if message == "" {
		t.Error("the error carries no message")
	}
}

func TestUnknownActionIsRejected(t *testing.T) {
	server := start(t)
	_, status := getJSON(t, server.URL+"/v1/analysis?action=vender_la_empresa")
	if status != http.StatusBadRequest {
		t.Fatalf("status %d, want 400 for a decision that does not exist", status)
	}
}

// TestResponseIsCacheable checks the header the whole cost model depends on.
func TestResponseIsCacheable(t *testing.T) {
	server := start(t)
	response, err := http.Get(server.URL + "/v1/analysis?action=none&seed=42&paths=1000")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)
	if got := response.Header.Get("cache-control"); got != "public, max-age=3600" {
		t.Errorf("cache-control = %q, want a public TTL", got)
	}
	if response.Header.Get("x-correlation-id") == "" {
		t.Error("no correlation id on the response")
	}
}

// TestActionsEndpointServesTheContract lets a client confirm which contract the
// API validates against.
func TestActionsEndpointServesTheContract(t *testing.T) {
	server := start(t)
	body, status := getJSON(t, server.URL+"/v1/actions")
	if status != http.StatusOK {
		t.Fatalf("status %d, want 200", status)
	}
	document := body.(map[string]any)
	if document["schema"] != "actions/v1" {
		t.Errorf("schema = %v, want actions/v1", document["schema"])
	}
	if _, ok := document["actions"].(map[string]any)["accept_project"]; !ok {
		t.Error("the contract does not declare accept_project")
	}
}

func getRaw(t *testing.T, url string) string {
	t.Helper()
	response, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	blob, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(blob)
}

func getJSON(t *testing.T, url string) (any, int) {
	t.Helper()
	response, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	blob, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out any
	if err := json.Unmarshal(blob, &out); err != nil {
		t.Fatalf("response is not JSON: %v\n%s", err, blob)
	}
	return out, response.StatusCode
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
				out = append(out, fmt.Sprintf("%s: missing", label(child)))
				continue
			}
			out = append(out, diff(child, actual[key], expected[key])...)
		}
		for _, key := range sortedKeys(actual) {
			if _, present := expected[key]; !present {
				out = append(out, fmt.Sprintf("%s: unexpected", label(path+"."+key)))
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
