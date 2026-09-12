# Resilia · 3D financial tower

A light dashboard for exploring Distribuidora Luna's liquidity before making a
decision. Built with React, TypeScript, Vite, Tailwind, Framer Motion and a local
copy of Inter. The tower uses Three.js, React Three Fiber, Drei and Rapier
physics. It needs no backend and no external services.

## Run

Requires Node.js 20.19+ or 22.12+ and pnpm (the only supported package manager).

```sh
pnpm install
pnpm dev
```

Open the URL Vite prints. `pnpm build` produces the static version in `dist/`.

## Simulating expenses

1. Enter the dashboard and pick an expense type and amount, or use the shortcuts.
2. Every expense removes at least one block; larger amounts remove more support
   (one block per $24,000, rounded up). The equivalence is illustrative, not
   accounting.
3. The engine updates balance, fragility, survival and projections. The tower
   loses height gradually and collapses if the minimum projected balance turns
   negative.
4. "Deshacer último gasto" reverts the last entry. "Reiniciar simulación" clears
   all expenses and scenarios.

The contract, equipment-purchase and customer-delay scenarios remain available.
The contract keeps its eight-second sequence, its result and its advance-payment
mitigation. Additional expenses feed the same engine; they are not real charges.

## Architecture

Organized by feature, with the dependency direction
`app -> features -> entities -> shared` (see `AGENTS.md` for the full detail):

- `src/app/`: composition. `App.tsx` loads data, wires the simulation flow and
  distributes props; `main.tsx` mounts React; `styles.css` is the single Tailwind
  entry point (tokens in `@theme`, reset in `@layer base`).
- `src/features/`: one folder per product capability — `onboarding`,
  `financial-overview`, `expense-simulation`, `scenario-simulation` (includes the
  `useSimulationFlow` reducer), `resilience-tower` (includes the pure view model
  `towerPresentation.ts` and the 3D runtime) and `technical-explanation`.
- `src/entities/`: domain without React — `business` (types, fixtures and
  `mockFinancialDataSource`), `scenario` and `simulation`
  (`simulateFinancialDecision`, the deterministic engine).
- `src/shared/`: domain-agnostic — `Modal` and `formatMoney`.

Each slice exposes its public API in an `index.ts`; the rest of its folder is
internal. The aliases `@app`, `@features`, `@entities`, `@shared` (configured in
`tsconfig.json` and `vite.config.ts`) are used for any import crossing from one
slice to another; within a slice, relative imports are used.

`FinancialDataSource` and `mockFinancialDataSource` (in `entities/business`)
delimit the future adapter for Capital One Nessie; `App.tsx` already consumes
them through a hook with loading states. The engine's comments mark the future
TDA integration and real cash simulation. Everything is mocked today: no
persistent homology runs and no scientific predictive power is claimed.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm check:boundaries
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check:boundaries` (`scripts/check-import-boundaries.ts`) fails if a file
imports against the direction `app -> features -> entities -> shared`, or makes a
deep import into another slice's internals instead of its `index.ts`.

Browser tests require Vite running. They cover desktop and phone, expense entry,
collapse, undo, reset, contract and advance payment, alternative scenarios and
operation without WebGL. They accept `PLAYWRIGHT_BASE_URL` and
`PLAYWRIGHT_EXECUTABLE_PATH` to reuse another port or an installed browser.

`prefers-reduced-motion` and "Ver resultado" allow animations to be skipped.
Inter and all assets are served locally. The Motion overrides are declared in
`package.json` and `pnpm-workspace.yaml` for a reproducible pnpm install.

## Language

User-facing copy is written in Spanish, because the product serves Mexican SMEs.
Code, identifiers, file names and comments are written in English. See the root
[`AGENTS.md`](../../AGENTS.md) for the full policy.
