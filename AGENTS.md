# AGENTS.md

Conventions for the whole repository. Area-specific rules live in the
corresponding area file — see [`apps/web/AGENTS.md`](apps/web/AGENTS.md) for the
front-end, which has its own architecture rules that take precedence there.

## Repository purpose

A structural fragility engine for Mexican SMEs. It turns a business decision
with user-supplied numbers into: weeks of survival, the first uncovered
obligation, a tension attribution per factor, and the minimum reinforcement that
restores stability.

Read `docs/prd-mvp.md` for scope and `docs/architecture.md` for the design before
making structural changes.

## Language policy

- **English** for code, identifiers, file and directory names, comments, commit
  messages, new documents, and the JSON contracts under `contracts/`.
- **Spanish** for user-facing copy — every string rendered in the interface.

The contract is the boundary: `collection_delay_days` in JSON, "Retraso en
cobranza" on screen. Never mix the two inside one layer.

## Layout

| Path | Contents | Language |
| --- | --- | --- |
| `apps/web/` | Front-end, Vite + React + TypeScript | TypeScript |
| `services/domain/` | Bounded contexts `scenario`, `risk` and `movements` | Go |
| `services/engine/` | Cash calendar, Monte Carlo, tension sweep | Python |
| `contracts/` | JSON schemas shared across services, and the SQL schema | JSON Schema, SQL |
| `infra/` | Terraform modules and environments | HCL |
| `docs/` | Product and architecture documents | Markdown |

## Rules that hold everywhere

- **Money is an integer count of cents.** Never a float, and never a float
  crossing a service boundary.
- **The engine is deterministic.** A fixed seed plus fixed inputs must produce
  byte-identical output. Reproducibility is what the project's credibility rests
  on; do not introduce unseeded randomness.
- **An unknown balance is never zero.** It is `unknown`, and it forces
  reconciliation.
- **Contracts change in `contracts/` first**, then in the services that read
  them. A schema mismatch must fail the build, never degrade silently.
- **No number reaches the screen without an engine run behind it.** Do not
  hand-write figures into fixtures or components. The ledger (`/movements`) is
  the one exception in kind, not in spirit: its figures come from the
  `movements` table, and nothing in the interface derives or recomputes one.
- **A read may degrade; a write never does.** When a service cannot answer, a
  view may fall back to a precomputed or bundled state *and say so*. A movement
  the database did not take is reported as unsent — never rendered as stored.
- **No secrets in the repository.** Use `.env.example` for variable names only.

## Toolchains

The repository root is language-neutral: it holds no package manifest and no
dependency manager. Each area declares its own dependencies and is run from its
own directory.

| Area | Manifest | Manager |
| --- | --- | --- |
| `apps/web` | `package.json` | pnpm, exclusively |
| `services/domain` | `go.mod` | Go modules |
| `services/engine` | `pyproject.toml` | pip / uv |
| `infra` | `*.tf` | Terraform |

Do not add a manifest, lockfile or `node_modules` at the root. A single
JavaScript package does not justify a workspace, and a workspace would make a
polyglot repository look JavaScript-first.

For the front-end, use pnpm only. Never run `npm install`, never create
`package-lock.json`, never hand-edit `pnpm-lock.yaml`. pnpm 11 reads settings
such as `overrides` from `apps/web/pnpm-workspace.yaml`, not from the `pnpm`
field in `package.json`.

```sh
cd apps/web
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm check:boundaries
```

## Working style

1. Inspect the real tree before assuming paths. This document is maintained, but
   the code is the source of truth.
2. Keep changes scoped to what was asked. Do not refactor adjacent code, rename
   things, or "fix" inherited behaviour inside an unrelated change — document it
   and ask.
3. Do not add a router, global store, architectural framework, or generic
   repository layer without a concrete requirement.
