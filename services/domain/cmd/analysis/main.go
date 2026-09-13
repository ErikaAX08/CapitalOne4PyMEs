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
	"github.com/jackc/pgx/v5/pgxpool"

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
	movements, pool, closeMovements, err := openMovements(context.Background(), cutoff, log)
	if err != nil {
		return err
	}
	defer closeMovements()

	// With a database, the analysis can run on any company it holds; the demo
	// company keeps coming from its fixture, so the product works unchanged
	// whether or not the database is reachable.
	var (
		profiles  riskapp.CompanyRepository = companies
		companyDB *companyadapter.PostgresRepository
	)
	if pool != nil {
		companyDB = companyadapter.NewPostgresRepository(pool, cutoff, companies)
		profiles = companyDB
		log.Info("company profiles served from the database",
			"fallback_company", companies.DefaultCompanyID())
	}

	// Which company a request with no company_id gets. It defaults to the demo
	// one, so the dashboard is unaffected; pointing it at a stored company is
	// how the reference set is demonstrated without passing an id every time.
	defaultCompany := env("DOMAIN_COMPANY_ID", companies.DefaultCompanyID())
	if defaultCompany != companies.DefaultCompanyID() {
		if pool == nil {
			return fmt.Errorf(
				"DOMAIN_COMPANY_ID is %s but no database is configured to read it from",
				defaultCompany)
		}
		// A company that does not exist is a typo in the configuration and is
		// worth refusing to start over, because every unqualified call would
		// then answer 404. A database that did not answer is not: it heals.
		checkCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		_, checkErr := profiles.Profile(checkCtx, defaultCompany)
		cancel()
		switch {
		case checkErr == nil:
			log.Info("default company overridden", "company_id", defaultCompany)
		case errors.Is(checkErr, companyadapter.ErrNotFound):
			return fmt.Errorf("DOMAIN_COMPANY_ID: %w", checkErr)
		default:
			log.Warn("could not verify the default company at start-up",
				"company_id", defaultCompany, "error", checkErr.Error())
		}
	}

	server := &Server{
		Builder:      scenarioapp.Builder{Catalog: catalog},
		Analyzer:     riskapp.Analyzer{Engine: engineadapter.NewClient(transport)},
		Companies:    profiles,
		Movements:    movements,
		Catalog:      companyDB,
		ActionsRaw:   catalog.Raw(),
		CompanyID:    defaultCompany,
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
			"company", defaultCompany,
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
func openMovements(ctx context.Context, cutoff kernel.CutoffDate, log *slog.Logger) (*movementsapp.Service, *pgxpool.Pool, func(), error) {
	dsn := env("DATABASE_CONNECTION_STRING", "")
	if dsn == "" {
		log.Warn("no movements database configured",
			"detail", "set DATABASE_CONNECTION_STRING to enable /v1/movements")
		return nil, nil, func() {}, nil
	}
	repo, err := movementspg.Open(ctx, dsn)
	if err != nil {
		// Only a malformed connection string reaches here, and retrying that
		// is pointless.
		return nil, nil, func() {}, err
	}

	// Whether it answers right now is worth knowing and worth saying, but not
	// worth refusing to start over: the pool reconnects on its own, and the
	// routes that need no database keep working meanwhile.
	probeCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if probeErr := repo.Probe(probeCtx); probeErr != nil {
		log.Warn("the movements database did not answer at start-up",
			"error", probeErr.Error(),
			"detail", "/v1/companies and /v1/movements will answer 503 until it does")
	} else {
		log.Info("movements database connected")
	}
	return &movementsapp.Service{Repo: repo, Cutoff: cutoff}, repo.Pool, repo.Close, nil
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
