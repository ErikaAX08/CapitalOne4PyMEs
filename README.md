# CapitalOne4PyMEs — Structural Fragility Engine for SMEs

**Second place in the Capital One challenge at HackMTY 2026.** Submitted as
**Stackly** by Erika Amastal, Ivan Torres, Alejandro Montano and Jose Horacio.

[![Stackly — Demo](https://img.youtube.com/vi/ktUqFQUjHio/maxresdefault.jpg)](https://www.youtube.com/watch?v=ktUqFQUjHio)

- [Live demo](https://d3ov5y7jcbbzbx.cloudfront.net)
- [Devpost submission](https://devpost.com/software/stackly-g7ucqd)
- [Submission write-up](docs/hackathon-submission.md) — the reasoning behind
  every figure the demo shows

A decision-support system for Mexican small and medium businesses. The user
describes a decision — take on a project, extend credit, hire, buy equipment,
take a loan — and the system computes which obligation would go uncovered, when,
and the smallest reinforcement that prevents it.

Design documents live in [`docs/`](docs/). Start with `prd-mvp.md` for scope and
`architecture.md` for the system design.

## Layout

```
apps/web/            Front-end. Vite + React + TypeScript.
services/domain/     Go. Bounded contexts: scenario, risk. Owns business invariants.
services/engine/     Python + NumPy. Cash calendar, Monte Carlo, tension sweep.
contracts/           JSON schemas shared by every service, and the SQL schema of
                     the database. The single source of truth.
infra/               Terraform. S3, CloudFront, API Gateway, Lambda, CI/CD roles.
docs/                Product and architecture documents.
```

## Request flow

```
Browser → CloudFront → API Gateway → Lambda (Go, domain) → Lambda (Python, engine)
```

The engine is deterministic given a fixed seed, so a response is a pure function
of its query parameters. That is why CloudFront caches it and why the seed is
part of the cache key.

Locally the same path runs without any of the AWS pieces: the Go service listens
on `:8080` and drives the engine as a child process, and `pnpm dev` proxies
`/v1` to it.

```sh
cd services/engine && python3 -m pip install -e ".[dev]"   # once
cd services/domain && go run ./cmd/analysis                # :8080
cd apps/web && pnpm dev                                    # :5173, proxies /v1
```

`/analysis` and `/movements` both need `services/domain` running, and `pnpm dev`
proxies `/v1` to **`http://localhost:8080`** — the port `go run ./cmd/analysis`
uses by default. A service started on any other port looks exactly like no
service at all, and the interface then says so and tells you the command.

The company's ledger (`/movements`) is the one part backed by a database:
`movements` lives on **Tiger Cloud**, which is PostgreSQL with TimescaleDB, and
everything else stays on AWS. Point `DATABASE_CONNECTION_STRING` at it — see
`services/domain/.env.example` — or leave it unset, in which case every other
route still works and `/v1/movements` answers 503 instead of pretending to
store anything. A database that is configured but momentarily unreachable does
not stop the service from starting: the pool reconnects on its own, and the
routes that need no database keep working meanwhile. Applying `contracts/database/schema.sql` to any PostgreSQL is
enough to run it locally.

Then open `/analysis` for the structural-fragility view. The interface renders
the precomputed base state immediately and degrades back to the nearest
precomputed state, labelled as approximate, whenever the engine cannot answer
within three seconds.

## Language policy

- **English** for everything the team writes: code, identifiers, file and
  directory names, comments, commit messages, documents, and the JSON contracts.
- **Spanish** for user-facing copy. The product serves Mexican SMEs, so every
  string rendered in the interface is written in Spanish.

A field is `collection_delay_days` in the contract and reads "Retraso en
cobranza" on screen. The boundary is the contract, not the component.

## Getting started

Each area owns its own toolchain and dependency manifest. There is no root
package manager: the repository root is language-neutral.

| Area | Manifest | Run from |
| --- | --- | --- |
| `apps/web` | `package.json` | `apps/web` |
| `services/domain` | `go.mod` | `services/domain` |
| `services/engine` | `pyproject.toml` | `services/engine` |
| `infra` | Terraform | `infra/envs/prod` |

Front-end, which needs Node.js 22.13+ and pnpm:

```sh
cd apps/web
pnpm install
pnpm dev
```

Per-area instructions live in each area's README. Front-end specifics —
architecture rules, testing, boundary checks — are in
[`apps/web/AGENTS.md`](apps/web/AGENTS.md).

## Verification

```sh
cd apps/web        && pnpm typecheck && pnpm test && pnpm check:boundaries && pnpm build
cd services/domain && go vet ./... && go test ./...
cd services/engine && python3 -m pytest -q && python3 scripts/generate_states.py --check
```

`apps/web` end-to-end tests need both servers running:

```sh
cd apps/web && pnpm test:e2e
```
