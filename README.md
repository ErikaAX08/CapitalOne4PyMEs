# CapitalOne4PyMEs — Structural Fragility Engine for SMEs

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
contracts/           JSON schemas shared by every service. The single source of truth.
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

Front-end, which needs Node.js 20.19+ and pnpm:

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
cd apps/web && pnpm typecheck && pnpm test && pnpm check:boundaries
```
