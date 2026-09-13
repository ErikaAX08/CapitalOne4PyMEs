# AGENTS.md

Front-end rules. Repository-wide conventions live in the root
[`AGENTS.md`](../../AGENTS.md); this file takes precedence within `apps/web/`.

## Repository purpose

Resilia is a React + TypeScript + Vite demo that lets you explore the impact of
simulated decisions and expenses on an SME's liquidity.

There are three views, and they do not share a data path:

- `/dashboard` — the 3D tower demo. The tower is a visual representation; its
  computations are deterministic and **mocked** (`simulateFinancialDecision`),
  not real financial predictions.
- `/analysis` — the structural-fragility view of `docs/prd-mvp.md` §3, Modules
  A to E. **Every figure on it comes from a state document the engine produced**
  through `GET /v1/analysis`. It derives nothing, interpolates nothing, and
  rounds nothing in a way that changes a number.
- `/movements` — the company's ledger: the `movements` table of
  `docs/data-model.md` §3, read and written through `/v1/movements`. It is the
  only view backed by a database (Tiger Cloud, PostgreSQL with TimescaleDB).
  Reading degrades to `entities/business/fixtures/movements.ts` and labels
  itself "Libro aproximado"; **writing never degrades** — a movement the service
  could not take is queued as unsent and never shown inside the ledger.

The actual tree (`src/app`, `src/features`, `src/entities`, `src/shared`) is the
source of truth on the current structure.

## Current state

- Feature-based architecture with the direction `app -> features -> entities -> shared`,
  verified by `pnpm check:boundaries`.
- `/dashboard`, `/movements` and `/analysis` are wrapped by `features/app-shell`: a sidebar with
  the two real routes, the current page's section anchors and its in-page
  commands, plus a top bar that names the view. Both views fill all three groups.
  The landing page (`/`) sits outside it and keeps its centred wordmark header.
  The sidebar collapses below 1000px, where `TopBar` surfaces the same routes and
  commands as a compact row.
- `app/MovementsView` (in `App.tsx`) owns the `useMovements` controller the same
  way, and for the same reason: the ledger's read loop must not run on the
  landing page or the dashboard.
- Money crosses the `/v1/movements` boundary as `amountCents`, an integer. The
  form multiplies by 100 once, at the edge; nothing downstream sees pesos.
- The Spanish a movement reads as (`Nómina`, `Esperado`, `CFDI`) is built in
  `entities/business/model/movementPresentation.ts`. The contract stays English
  (`payroll`, `expected`, `cfdi`) — the boundary is that module, not the
  component.
- `app/AnalysisView` (in `App.tsx`) owns the `useAnalysis` controller and passes
  it to `AnalysisPage`, so the shell's commands and the page's own controls drive
  one state. Keep the hook behind that route component: calling it higher up
  would start the engine loop on the landing page and the dashboard too.
- pnpm is the only package manager, with `packageManager` pinned and a single lockfile.
- `/analysis` is fed by `entities/analysis`: contract types, the action
  catalogue read from `contracts/actions.schema.json` through the `@contracts`
  alias, an HTTP data source, and the nearest-fallback selection. The five PRD
  modules are presentational features; `app/useAnalysis.ts` wires them.
- `pnpm dev` proxies `/v1` to `http://localhost:8080`, where `services/domain`
  listens (`VITE_API_ORIGIN` overrides the target). Start it with
  `cd services/domain && go run ./cmd/analysis`.
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
  reused (today: `Modal`, `Logo`, `formatMoney`).
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
- Grid placement (`col-start`, `row-span`, ...) belongs to the composing parent,
  not to the placed component: `TowerCard` owns its sticky behaviour and height,
  `app/App.tsx` owns where it sits in the dashboard grid.
- Styling: use Tailwind utility classes directly in the component's JSX. Reserve
  `@layer base` in `src/app/styles.css` for element resets (buttons, headings,
  focus) that would otherwise be repeated in every component; do not put
  single-feature styles there.

## Contracts to preserve

- All data is simulated and is presented as such.
- On `/analysis`, no number reaches the screen without an engine run behind it.
  Do not hand-write a figure into a component, and do not compute one from
  another: the interface selects, formats and presents.
- `warnings` and `notices` from a state document are always rendered. A
  non-empty array that does not appear on screen is a defect.
- The degradation path is not optional: when the engine cannot answer, the view
  shows the nearest precomputed state from `public/states/` and labels it
  "Escenario aproximado". Those files are written by
  `services/engine/scripts/generate_states.py`; never edit them by hand.
- No colour token may have a hue between 40 and 75 degrees. `--color-warning-soft`
  sits at exactly 40.0 and predates this rule being checked; `/analysis` uses
  `--color-tension-soft` instead rather than restyling components that already
  depend on it.
- The tower has 12 levels and 36 blocks; the physics does not compute risk.
- Keyboard support, reduced motion, the no-WebGL fallback and responsive layout
  must be maintained.
- The landing header carries no account context: `Demo con datos simulados`,
  `Mariana Luna` and `Administradora` belong to the shell's top bar, and the
  wordmark stays horizontally centred on `/` (an e2e assertion checks both).
- Demo assets stay local; do not add external calls without authorization. The
  one service the interface talks to is `services/domain` on the same origin,
  through the `/v1` proxy.
- The dashboard's simulated expenses and the ledger's movements are different
  things and must stay distinguishable on screen: the first explores a scenario
  and is forgotten, the second is stored. Do not merge them without asking.
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
