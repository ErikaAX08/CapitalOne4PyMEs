# AGENTS.md

Front-end rules. Repository-wide conventions live in the root
[`AGENTS.md`](../../AGENTS.md); this file takes precedence within `apps/web/`.

## Repository purpose

Resilia is a React + TypeScript + Vite demo that lets you explore the impact of
simulated decisions and expenses on an SME's liquidity. The 3D tower is a visual
representation; the current computations are deterministic and mocked, not real
financial predictions.

The actual tree (`src/app`, `src/features`, `src/entities`, `src/shared`) is the
source of truth on the current structure.

## Current state

- Feature-based architecture with the direction `app -> features -> entities -> shared`,
  verified by `pnpm check:boundaries`.
- pnpm is the only package manager, with `packageManager` pinned and a single lockfile.
- Styling with Tailwind CSS v4 (utility classes on each component);
  `src/app/styles.css` contains only `@theme`, `@layer base` and the
  `prefers-reduced-motion` reset. There is no per-feature CSS and no monolithic
  stylesheet.
- Check the real tree (`find src -maxdepth 2`) before assuming paths: this
  document is maintained, but the code wins.

## Package manager

Use pnpm for every operation:

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

Do not run `npm install`, do not generate `package-lock.json`, and do not
hand-edit `pnpm-lock.yaml`. If dependencies change, use the corresponding pnpm
command and commit the resulting lockfile.

Add `typecheck`, `test`, `test:e2e`, `check:boundaries`, `format` and
`format:check` to `package.json` if they ever go missing; today they all exist.

## Architecture rules

- `app` (`src/app/`) composes and initializes; it holds no financial logic and no
  large feature implementations.
- `features` (`src/features/<name>/`) is organized by product capability, not by
  global technical type.
- `entities` (`src/entities/<name>/`) holds contracts, fixtures, data sources and
  pure domain logic.
- `shared` (`src/shared/`) holds only domain-agnostic pieces that are genuinely
  reused (today: `Modal`, `formatMoney`).
- Allowed direction: `app -> features -> entities -> shared`.
  `pnpm check:boundaries` verifies it; run it if you touch imports between slices.
- No deep imports into another slice; import from its public `index.ts` (use the
  aliases `@app`, `@features/<name>`, `@entities/<name>`, `@shared` to cross
  slices — relative imports only within the same slice).
- A feature does not import another feature's internals; an entity may import
  another entity and `shared`, but never a feature or `app`.
- Do not introduce a router, global store, architectural framework or generic
  repositories without a concrete requirement.
- Keep `simulateFinancialDecision` (in `entities/simulation`) pure and
  deterministic.
- `formatMoney` lives in `shared/lib/`, not in the engine and not in any feature.
- The UI consumes business/transaction data through `mockFinancialDataSource`
  (in `entities/business`), not by importing fixtures directly. Scenarios
  (`entities/scenario`) are the exception: they have no async data source and are
  imported as a fixture because there is no Nessie-equivalent adapter for them.
- Styling: use Tailwind utility classes directly in the component's JSX. Reserve
  `@layer base` in `src/app/styles.css` for element resets (buttons, headings,
  focus) that would otherwise be repeated in every component; do not put
  single-feature styles there.

## Contracts to preserve

- All data is simulated and is presented as such.
- The tower has 12 levels and 36 blocks; the physics does not compute risk.
- Keyboard support, reduced motion, the no-WebGL fallback and responsive layout
  must be maintained.
- Demo assets stay local; do not add external calls without authorization.
- Do not change figures and formulas documented as part of a refactor.
- Flow state (`SimulationFlowState`, in `features/scenario-simulation`) and
  financial state (`SimulationOutput.status`) are distinct concepts; they no
  longer share the name `critical` (the flow one is `result`).
- Do not add secrets or credentials to the client. Use `.env.example` for
  variable names only, without sensitive values.
- The tower's week labels and the subtitle "Sin afectar tu negocio real" are now
  visible (they were previously hidden by CSS inherited from the 2D stage). If
  you find another inherited behaviour like this, document it and ask before
  "fixing" it inside an unrelated refactor.

## Language

User-facing copy is written in Spanish; code, identifiers, file names and
comments are written in English. See the root `AGENTS.md` for the full policy.

## Working style

1. Inspect `package.json`, the real tree and existing changes before editing.
2. Make vertical, small migrations; avoid moving the whole repository in one change.
3. Characterize behaviour first, then move code, and only then improve internal design.
4. Preserve the user's changes and do not reformat unrelated files.
5. Put tests next to the domain or feature they protect; reserve `tests/` for E2E.
6. Do not use large snapshots as a substitute for behavioural assertions.
7. Update imports and tests in the same change that moves a module.
8. If a phase reveals a pre-existing bug, document it and separate it from the refactor.

## Minimum validation

Before closing a code change, run in proportion to its scope:

```sh
pnpm typecheck
pnpm test
pnpm build
```

If you touched imports between slices:

```sh
pnpm check:boundaries
```

For changes to flow, accessibility, layout, WebGL or the tower:

```sh
pnpm test:e2e
```

E2E expects a server reachable at `http://localhost:5173` unless
`PLAYWRIGHT_BASE_URL` is set. `PLAYWRIGHT_EXECUTABLE_PATH` lets you reuse an
installed Chromium.

Do not claim a validation passed if it was not run in the current session. Report
warnings and limitations, especially the visual checks of the physics.

## Criteria for new abstractions

Extract an abstraction when it has a clear owner, reduces real coupling, or
enables a second known implementation. Do not create empty folders or
speculative layers to make the tree match the plan. The target tree is a guide to
responsibilities, not a file quota.
