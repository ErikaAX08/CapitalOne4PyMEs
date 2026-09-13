# services/engine — Python

Pure computation. No database, no persistence, no knowledge of HTTP beyond a thin
Lambda handler. Receives a parameterization, returns numbers.

NumPy only — no CatBoost in the MVP. That is deliberate: without it the function
packages as a zip instead of a container image, which cuts cold start from
3–8 seconds to roughly one.

The package is the port of `motor-pyme-solo-codigo/codigo/motor.py` to the
architecture in `docs/architecture.md`. The review of that port, the decisions
taken and the open items are in `docs/engine-alignment.md`.

## Modules

| Module | Responsibility | Status |
| --- | --- | --- |
| `engine/cash/` | Canonical movements, reconciliation rules, deterministic ledger, company profile and recurring rules | Ported, tested |
| `engine/simulation/` | Monte Carlo worlds, vectorised simulation, Wilson summaries, one-step reinforcement grid | Ported, tested |
| `engine/tension/` | Univariate sweeps (delay, sales, cost) and the six-factor tension array | New, tested |
| `engine/actions.py` | The five decisions as calendar transformations | New, tested |
| `engine/stress.py` | Collection delay, main customer lost, capital injection | New, tested |
| `engine/graph.py` | Six stacks, implemented edges, propagation path | Ported |
| `engine/analysis.py` | Request → result orchestration, survival state, abstention | New |
| `engine/projection.py` | Result → state document (`contracts/state.schema.json`) | New; reference for the Go projector |
| `engine/handler.py` | Lambda entry point (`lambda:Invoke` and API Gateway `GET`) | New |

## Invariants

Covered by the suite (54 tests). Do not weaken them.

- Cash is conserved: `balance(t) = balance(t-1) + inflows - outflows`.
- An unknown balance is never substituted with zero; it forces reconciliation.
  Above 20% unknown profile variables the result is an abstention.
- No future information is used when projecting from the cut-off date.
- Payment ordering within a day is explicit: receipts first, then priority.
- No action increases total revenue; it reschedules it. No movement predates day 0.
- Compared actions share the same Monte Carlo worlds; the reinforcement is
  searched on `seed` and verified on `seed + 1`.
- Money is integer cents at every boundary.

## Determinism

Same seed plus same inputs produce byte-identical output. The report protocol
(20,000 futures, search 781, verification 782) is one parameterization of this
engine, and `tests/test_report_figures.py` pins every figure of
`docs/evaluation-report.md` §3.

## Running

```sh
cd services/engine
python3 -m pytest -q
uv tool run ruff check .
python3 scripts/generate_states.py            # phase 0: validate, then write fixtures
python3 scripts/generate_states.py --check    # CI data gate: fixtures reproduce byte for byte
scripts/package_lambda.sh                     # arm64 zip with NumPy, fixtures and contracts
```

`generate_states.py` runs in two steps, and the order matters:

1. **Validate** — run at zero delay and confirm the engine reproduces the report
   (0.0%, 46.9%, 4.6%, breaking point 16 days, payroll on day 75, $40,000).
2. **Generate** — run the four PRD parameterizations at seed 42 and write
   `fixtures/states/` and `apps/web/public/states/`.

Copying figures from step 1 into step 2 is the mistake to avoid: the reported
figures are at zero delay, the states carry sixteen days.

## Invoking the handler locally

```sh
python3 -c "
import json; from engine.handler import handler
r = handler({'rawQueryString': '', 'queryStringParameters': {'collection_delay_days': '16'}})
print(json.loads(r['body'])['explanation'])"
```

Environment variables: `ENGINE_CONTRACTS_DIR` (defaults to the repository
`contracts/`), `ENGINE_COMPANY_PROFILE` (defaults to the demo agency),
`ENGINE_CUTOFF_DATE`, `ENGINE_CACHE_CONTROL`.
