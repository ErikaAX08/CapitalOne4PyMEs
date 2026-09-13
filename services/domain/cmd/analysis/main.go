// Command analysis is the domain service: it validates a request against the
// action schema, commits a scenario, has the Python engine compute it, and
// projects the result into the state document.
//
// Two run modes are planned; one exists today.
//
//   - HTTP server (this file). The engine runs as a local worker process, so the
//     whole path — browser, Go, Python, state document — can be demonstrated
//     with no AWS account and no Terraform.
//   - AWS Lambda behind API Gateway. Adding it means one more Transport
//     implementation (lambda:Invoke) and one more entry point; nothing above the
//     transport changes. It is not written yet: infra/ holds no Terraform, so
//     there is nothing to deploy it onto.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	movementspg "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/adapters/postgres"
	movementsapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/movements/application"
	companyadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/company"
	engineadapter "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/adapters/engine"
	riskapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/adapters/schema"
	scenarioapp "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/application"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// Defaults. Every one of them can be overridden by the matching environment
// variable, and none of them is a secret: the repository holds no credentials.
const (
	defaultAddr = ":8080"
	// defaultCutoff matches ENGINE_CUTOFF_DATE in engine/handler.py, so the Go
	// path and the Python path date the same run identically.
	defaultCutoff       = "2026-09-12"
	defaultCacheControl = "public, max-age=3600"
	defaultTimeout      = 10 * time.Second
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)
	if err := run(log); err != nil {
		log.Error("fatal", "error", err.Error())
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	root, err := repositoryRoot()
	if err != nil {
		return err
	}
	contractsDir := env("DOMAIN_CONTRACTS_DIR", filepath.Join(root, "contracts"))
	engineDir := env("DOMAIN_ENGINE_DIR", filepath.Join(root, "services", "engine"))
	profilePath := env("DOMAIN_COMPANY_PROFILE",
		filepath.Join(engineDir, "fixtures", "company_demo_agency.json"))

	catalog, err := schema.Load(contractsDir)
	if err != nil {
		return err
	}
	companies, err := companyadapter.LoadFixture(profilePath)
	if err != nil {
		return err
	}
	cutoff, err := kernel.ParseCutoffDate(env("DOMAIN_CUTOFF_DATE", defaultCutoff))
	if err != nil {
		return err
	}
	transport, err := engineadapter.NewLocalTransport(
		env("DOMAIN_PYTHON", "python3"), engineDir, log)
	if err != nil {
		return err
	}
	defer func() { _ = transport.Close() }()

	// The ledger lives in PostgreSQL — Tiger Cloud in deployment, any
	// PostgreSQL locally. Without a connection string the service still starts
	// and every other route works: only /v1/movements answers 503, because a
	// ledger that silently forgets what it was told is worse than one that
	// says it is unavailable.
	movements, closeMovements, err := openMovements(context.Background(), cutoff, log)
	if err != nil {
		return err
	}
	defer closeMovements()

	server := &Server{
		Builder:      scenarioapp.Builder{Catalog: catalog},
		Analyzer:     riskapp.Analyzer{Engine: engineadapter.NewClient(transport)},
		Companies:    companies,
		Movements:    movements,
		ActionsRaw:   catalog.Raw(),
		CompanyID:    companies.DefaultCompanyID(),
		Cutoff:       cutoff,
		CacheControl: env("DOMAIN_CACHE_CONTROL", defaultCacheControl),
		Timeout:      timeout(),
		Log:          log,
	}

	addr := env("DOMAIN_ADDR", defaultAddr)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           server.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errs := make(chan error, 1)
	go func() {
		log.Info("listening",
			"addr", addr,
			"contracts", contractsDir,
			"engine", engineDir,
			"company", companies.DefaultCompanyID(),
			"cutoff_date", cutoff.ISO(),
		)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- err
		}
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	}
}

// openMovements connects the ledger if a connection string is configured.
//
// DATABASE_CONNECTION_STRING is the name Tiger Data's own Go guide uses; the
// value never appears in the repository or in a log line, only in the
// environment. A configured-but-unreachable database is a start-up failure: it
// means the operator intended persistence and did not get it.
func openMovements(ctx context.Context, cutoff kernel.CutoffDate, log *slog.Logger) (*movementsapp.Service, func(), error) {
	dsn := env("DATABASE_CONNECTION_STRING", "")
	if dsn == "" {
		log.Warn("no movements database configured",
			"detail", "set DATABASE_CONNECTION_STRING to enable /v1/movements")
		return nil, func() {}, nil
	}
	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	repo, err := movementspg.Open(connectCtx, dsn)
	if err != nil {
		return nil, func() {}, err
	}
	log.Info("movements database connected")
	return &movementsapp.Service{Repo: repo, Cutoff: cutoff}, repo.Close, nil
}

func env(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func timeout() time.Duration {
	raw := os.Getenv("DOMAIN_ENGINE_TIMEOUT_SECONDS")
	if raw == "" {
		return defaultTimeout
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return defaultTimeout
	}
	return time.Duration(seconds) * time.Second
}

// repositoryRoot walks up from the working directory until it finds the
// contracts directory, so the service runs the same from services/domain, from
// the repository root, or from wherever a build placed the binary.
func repositoryRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "contracts", schema.FileName)); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf(
				"no contracts/%s found above the working directory; set DOMAIN_CONTRACTS_DIR",
				schema.FileName)
		}
		dir = parent
	}
}

// newCorrelationID mints the id when the edge did not supply one.
func newCorrelationID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(b[:])
}
