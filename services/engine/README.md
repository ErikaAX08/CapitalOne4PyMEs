# services/engine — Python

Pure computation. No database, no persistence, no knowledge of HTTP beyond a
thin Lambda handler. Receives a parameterization, returns numbers.

NumPy only — no CatBoost in the MVP. That is deliberate: without it the function
packages as a zip instead of a container image, which cuts cold start from
3–8 seconds to roughly one.

## Modules

| Module | Responsibility | Status |
| --- | --- | --- |
| `engine/cash/` | Cash calendar, obligations, collections, deterministic path | Implemented and tested |
| `engine/simulation/` | Monte Carlo, breaking point, one-percentage-point grid search for the minimum reinforcement | Implemented and tested |
| `engine/tension/` | Univariate margin sweep producing the tension array | To build |

## Invariants

These are covered by the existing suite — 30 engine tests and 6 evaluation
tests. Do not weaken them.

- Cash is conserved: `balance(t) = balance(t-1) + inflows - outflows`.
- An unknown balance is never substituted with zero; it forces reconciliation.
- No future information is used when projecting from the cut-off date.
- Payment ordering within a day is explicit, not insertion order.
- An advance payment reschedules revenue; it never increases the total.

## Determinism

Same seed plus same inputs must produce byte-identical output. Compared actions
must share the same Monte Carlo worlds, otherwise the comparison is invalid.

CI regenerates the golden fixtures with seed 42 and fails on any difference.

## Scripts

`scripts/generate_states.py` produces the fallback state documents consumed by
the front-end. It runs in two steps, and the order matters:

1. **Validate** — run at zero delay and confirm the engine reproduces the figures
   in `docs/evaluation-report.md`.
2. **Generate** — run the four parameterizations and write the documents.

Copying figures from step 1 into step 2 is the mistake to avoid: the reported
figures are at zero delay, the states carry sixteen days.
