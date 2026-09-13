# services/domain — Go

Owns the business invariants and the anti-corruption layer over the Python
engine. A modular monolith, not a set of microservices.

Request path:

```
browser → GET /v1/analysis?… → scenario (validate, commit) → engine (Python)
                                    ↓                            ↓
                               state document ← risk (translate, project)
```

## Running it locally

The service starts as an HTTP server and runs the engine as a local worker
process, so the whole path can be demonstrated with no AWS account and no
Terraform.

```sh
cd services/domain
go run ./cmd/analysis        # listens on :8080
```

It needs Python with NumPy available for `services/engine`:

```sh
cd services/engine && python3 -m pip install -e ".[dev]"
```

Then, from `apps/web`, `pnpm dev` proxies `/v1` to `http://localhost:8080`
(`VITE_API_ORIGIN` overrides the target).

```sh
curl 'localhost:8080/v1/analysis?action=accept_project&collection_delay_days=16&seed=42'
```

| Endpoint | Returns |
| --- | --- |
| `GET /v1/analysis` | The state document (`contracts/state.schema.json`), with a public cache TTL |
| `GET /v1/actions` | `contracts/actions.schema.json` verbatim, so a client can confirm which contract is being validated against |
| `GET /health` | Liveness |

A rejected parameter answers `400` with `{"error", "message"}`, the same shape
`engine/handler.py` already returns, so a client sees one error format
regardless of which service refused the request.

### Configuration

No secret, and every value has a working default. Paths are resolved by walking
up from the working directory until `contracts/` is found.

| Variable | Default |
| --- | --- |
| `DOMAIN_ADDR` | `:8080` |
| `DOMAIN_CONTRACTS_DIR` | `<repo>/contracts` |
| `DOMAIN_ENGINE_DIR` | `<repo>/services/engine` |
| `DOMAIN_COMPANY_PROFILE` | `<engine>/fixtures/company_demo_agency.json` |
| `DOMAIN_PYTHON` | `python3` |
| `DOMAIN_CUTOFF_DATE` | `2026-09-12` (matches `ENGINE_CUTOFF_DATE`) |
| `DOMAIN_CACHE_CONTROL` | `public, max-age=3600` |
| `DOMAIN_ENGINE_TIMEOUT_SECONDS` | `10` |

### What is not built yet

The Lambda run mode. `engine.Transport` is the seam: `LocalTransport` runs the
engine as a child process today, and a `lambda:Invoke` implementation drops in
beside it without touching the translator, the projector or either context.
There is nothing to deploy it onto yet — `infra/` holds no Terraform.

## Bounded contexts

| Context | Aggregates and value objects | Invariants it enforces |
| --- | --- | --- |
| `scenario` | `Scenario`, `Action`, `Stress`, `Seed` | A committed scenario is immutable · the seed is fixed at creation · no action increases total revenue, it only reschedules it · no movement may predate the cut-off date |
| `risk` | `Assessment`, `Coverage`, `State`, `Reinforcement` | Above 20% unknown variables the result is an abstention, not a probability · every probability declares its event and horizon · the engine must echo back the seed and horizon it was given |

`shared/kernel` holds the types both contexts depend on: `Money` (int64 cents),
`CutoffDate`, `Horizon`, `Probability`, `Confidence`, `Provenance`, and
`Company` — the profile both contexts reference, whose field set is exactly the
`company` block of `contracts/engine-request.schema.json`.

## Layout

```
cmd/analysis/                 composition root: HTTP server and wiring
internal/scenario/
  domain/                     the five decisions, the scenario aggregate, invariants
  application/                the ActionCatalog port and the scenario builder
  adapters/schema/            contracts/actions.schema.json → coerced parameters
internal/risk/
  domain/                     Assessment, Coverage, State
  application/                the Engine port and the Analyzer use case
  adapters/engine/            request builder, transports, translator (the ACL)
  adapters/projection/        Assessment → state document, and the Spanish copy
  adapters/company/           the company profile repository
internal/shared/kernel/
```

## The rule that makes this DDD rather than folders

`internal/*/domain/` imports nothing from `aws-sdk-go-v2` and nothing from an
`adapters` package. It is checked in CI:

```sh
! grep -rl "aws-sdk-go-v2\|/adapters" internal/*/domain/
```

If a domain type needs something from infrastructure, the dependency is
inverted — the port lives in `application/`, the implementation in `adapters/`.

The service depends on no third-party Go module: `go.mod` declares no `require`.
That is not asceticism, it is the cheapest way to keep the purity rule true and
the build reproducible.

## The Action interface

An `Action` is an immutable value object. It knows nothing about Monte Carlo,
probabilities, or the interface.

```go
type Action interface {
    Kind() ActionKind
    Validate() error
    Parameters() map[string]any
}
```

**Deviation from `docs/architecture.md` §5.1, taken deliberately.** The design
document also declares `Apply(kernel.Calendar) kernel.Calendar`. The cash
calendar is owned by the Python engine — `architecture.md` §6.1 lists `cash` as
"exists and is tested", and §6 states that rewriting it in Go would be pure
cost. Implementing `Apply` here would be a second, untested engine, and two
implementations of the same calendar would eventually disagree. Go owns what Go
can own: the closed set of kinds, the parameter invariants the JSON schema
cannot express, and the immutability of a committed scenario.

## Adding a decision

1. Add the parameter schema to `contracts/actions.schema.json`.
2. Implement it in `engine/actions.py`.
3. Add a case to `domain.action.Validate` only if it has invariants relating two
   parameters that the schema cannot express.

The front-end form is generated from the schema and the catalogue reads it, so
no interface component and no adapter changes.

## Verification

```sh
go vet ./... && go test ./...
! grep -rl "aws-sdk-go-v2\|/adapters" internal/*/domain/
```

Two tests carry most of the weight:

- `internal/risk/adapters/projection/document_test.go` replays four captured
  engine results through the Go projector and compares the output against the
  four fallback states `engine/scripts/generate_states.py` wrote. It is the
  contract gate: the Go projector and `engine/projection.py` must produce the
  same document. The comparison is semantic rather than byte-for-byte — Python
  writes an integral float as `1.0` where Go writes `1`, which is the same JSON
  number — but every field, string and value must match.
- `cmd/analysis/e2e_test.go` runs the same four parameterizations over HTTP
  against the live engine and compares against the same files. It skips when
  Python or NumPy is unavailable.

Regenerate the captured results after an engine change:

```sh
python3 scripts/generate-engine-results.py
```
