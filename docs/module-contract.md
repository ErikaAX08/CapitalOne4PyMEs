# Module contract — what each PRD card needs and where the engine provides it

Binding contract between the interface modules of `prd-mvp.md` §3 and the state
document (`contracts/state.schema.json`). One row per figure or text the card
renders. Every row is produced by `services/engine/engine/projection.py` and
checked by `services/engine/tests/test_module_contract.py` over the four fallback
states, so a missing field fails the build, not the demo.

Rules that hold for every row:

- **Field names are English; `label`, `headline`, `explanation` and `notices`
  are Spanish.** The document is the language boundary. The front-end formats
  (currency, percentages, Title Case), it does not translate or compute.
- **Money is integer cents** (`*_cents`). Percentages are numbers in [0, 1] for
  frequencies and in [0, 100] for the advance.
- **Every figure has an engine run behind it.** The document carries the inputs
  of each derived figure (margin and range, before and after, seed, paths).

---

## Module A — Survival indicator

PRD §3.1: weeks of survival, state label, dynamic text naming the concrete
obligation, definition tooltip.

| The card shows              | Field                                     | Type                                                                   | Computed as                                                                                                                                                       |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero number of weeks        | `survival.weeks`                          | integer                                                                | whole weeks from the cut-off to the first uncovered obligation on the deterministic path; `horizon_days ÷ 7` when none                                            |
| "> 25" prefix               | `survival.upper_bounded`                  | boolean                                                                | `true` when no gap appears within the horizon                                                                                                                     |
| Colour and state chip       | `survival.state` · `survival.state_label` | `stable · tension · crisis` / `Estable · Tensión · Crisis Estructural` | stable: no gap · tension: timing gap, recurring flow positive, path ends positive · crisis: recurring flow negative, or path ends negative, or gap within 4 weeks |
| Dynamic text                | `survival.headline`                       | Spanish sentence                                                       | one of the four PRD texts, composed with `first_obligation.label`, `date_text`, `day` and `gap_cents`                                                             |
| First obligation at risk    | `survival.first_obligation`               | object or `null`                                                       | `kind` (node id), `label` (Title Case), `day`, `date` (ISO), `date_text` ("26 de noviembre"), `gap_cents`                                                         |
| Audit of the classification | `survival.net_recurring_flow_cents`       | integer                                                                | recurring inflows minus outflows per 30 days, with the customer-loss stress applied                                                                               |
| Tooltip                     | `definitions.survival_weeks`              | Spanish text                                                           | fixed definition from PRD §3.1                                                                                                                                    |

Verified on the fixtures: `base` → 25 weeks, bounded, `Estable`; `tension` →
10 weeks, "La nómina del 26 de noviembre queda descubierta por $40,000";
`crisis` → 6 weeks, "Se requiere acción"; `reinforced` → 25 weeks, `Estable`.

---

## Module B — Sandbox simulator

PRD §3.2: decision selector, form generated from the action schema, stress
controls with fixed marks, run and reset.

| The card needs                               | Source                                                 | Notes                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The five decisions, their labels and default | `contracts/actions.schema.json → actions`              | `accept_project` carries `"default": true`; `none` is the current operation                                                                                                                     |
| Parameter type, bounds, default, step, mark  | `actions[kind].parameters[]`                           | types `money · percentage · days · integer · boolean · date`; `mark` holds the PRD thresholds (16 days, 25%, $200,000) as data                                                                  |
| Stress controls                              | `stress.parameters[]`                                  | delay 0–60 days, main customer lost, injection $0–$400,000                                                                                                                                      |
| Run parameters                               | `run.parameters[]`                                     | `paths` 100–20,000 (default 5,000), `seed` (default 42), `horizon_days`                                                                                                                         |
| Query string                                 | every parameter id, verbatim                           | `GET /v1/analysis?action=…&total_revenue_cents=…&seed=42`; missing ids take the schema default; out-of-range values return HTTP 400                                                             |
| Echo of what was computed                    | `parameterization`                                     | action kind, action parameters and the three stress values exactly as the engine used them; the front uses it to confirm the response matches the last request and to pick the nearest fallback |
| Reproducibility                              | `seed`, `simulation.paths`, `engine_version`, `schema` | part of the cache key; shown in Module E                                                                                                                                                        |

The defaults reproduce the report scenario: revenue $800,000, initial cost
$380,000, advance 0%, collection at 60 days, 2 hires, delivery at 30 days.

---

## Module C — Tension and attribution radar

PRD §3.3: six horizontal bars grouped by stack, descending order, tooltip with
the computation, declared assumptions flagged.

| The card shows                      | Field                                            | Type                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six bars, already sorted descending | `tension[]`                                      | array of six objects                                                                                                                                                    |
| Bar label                           | `tension[].label`                                | Spanish, Title Case                                                                                                                                                     |
| Stack group                         | `tension[].stack` · `tension[].stack_label`      | `people · finance · sales · operations …` / `Personas · Finanzas · Ventas · Operaciones …`                                                                              |
| Bar length and colour               | `tension[].tension`                              | number in [0, 1], two decimals                                                                                                                                          |
| Tooltip inputs                      | one `margin_*` and one `range_*` pair per factor | `margin_cents/range_cents` (payroll), `margin_days/range_days` (collection period, delay tolerance), `margin_pp/range_pp` (cost, sales), `margin/range` (concentration) |
| "Supuesto declarado" flag           | `tension[].range_source`                         | `documented · control_range · declared_assumption`                                                                                                                      |
| Tolerance beyond the search grid    | `tension[].search_bounded`                       | `true` when no perturbation on the grid opens a gap; tension is then 0                                                                                                  |
| Tooltip definition                  | `definitions.tension`                            | fixed text from PRD §3.3                                                                                                                                                |

Verified: the `tension` fixture reproduces the PRD §3.3 table exactly —
1.00 · 0.75 · 0.73 · 0.65 · 0.50 · 0.46 — with margin −$40,000 on payroll
coverage.

---

## Module D — Minimum reinforcement and propagation path

PRD §3.4: recommended action, before/after table on the same worlds,
five-node path with origin and breaking node, one-sentence explanation.

| The card shows           | Field                                                                                                         | Type                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Recommended action       | `minimum_reinforcement.label`                                                                                 | Spanish, e.g. "Solicitar un anticipo de 27% ($216,000)"                                                                              |
| Kind and size            | `minimum_reinforcement.kind` · `percentage` · `amount_cents` · `additional_percentage`                        | `advance` for `accept_project`; `capital_injection` for the other decisions or when no advance suffices                              |
| Was it needed            | `minimum_reinforcement.required` · `found`                                                                    | `required = false` when the Wilson upper bound is already ≤ 5%; `found = false` when the grid is exhausted                           |
| "Before" column          | `minimum_reinforcement.before`                                                                                | `gap_frequency`, `weeks`, `upper_bounded`, `state`, `state_label` — identical to `simulation` and `survival`                         |
| "After" column           | `gap_frequency_after`, `ci95_after`, `weeks_after`, `upper_bounded_after`, `state_after`, `state_label_after` | same parameterization plus the reinforcement, same verification worlds                                                               |
| Path nodes               | `propagation_path.nodes` · `node_labels`                                                                      | ordered node ids and their Spanish labels ("Entrega → Factura → Cobro → Efectivo → Nómina")                                          |
| Highlighted nodes        | `propagation_path.origin_node` · `breaking_node`                                                              | origin follows the stress or the action; breaking is the first uncovered obligation, `null` when stable                              |
| One-sentence explanation | `explanation`                                                                                                 | composed from `effective collection day`, `first_obligation`, `gap_cents` and the reinforcement; changes with every parameterization |
| Tooltip                  | `definitions.gap_frequency`                                                                                   | what a gap frequency is and is not                                                                                                   |

The `minimum_reinforcement` object is `null` when the action is `none`: there is
no decision to reinforce. When `found` is `false` the label reads "Ningún
refuerzo dentro del rango evaluado" and Module E carries the matching notice.

---

## Module E — Scope and limitations strip

PRD §3.5: base strip, dynamic chips from `warnings`, abstention state,
approximate-scenario chip.

| The strip shows                                                       | Field                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Escenario sintético en MXN · Sin validación en población mexicana …" | `notices[].label` for the four base codes, in order                                                                                                                                                                                                               |
| "Semilla 42 · Motor 1.0.0"                                            | `seed` · `engine_version`                                                                                                                                                                                                                                         |
| Dynamic chips                                                         | `notices[]` — `{code, label}` for every entry in `warnings`, same order, always rendered                                                                                                                                                                          |
| Abstention                                                            | `state_id = "abstention"`, `state_label = "Sin Estimación"`, `survival`, `simulation`, `propagation_path` and `minimum_reinforcement` are `null`, `explanation` is "Cobertura de datos insuficiente. No se emite estimación.", `coverage.unknown_fraction > 0.20` |
| "Escenario aproximado" chip                                           | front-end state, not a document field: raised when the response is a fallback file instead of the API                                                                                                                                                             |

Warning codes the engine can emit: `synthetic_assumptions`,
`no_mexico_validation`, `declared_reference_range`,
`monte_carlo_excludes_distribution_error` (always), plus
`collection_beyond_horizon`, `no_reinforcement_within_grid`,
`reinforcement_grid_is_capital_injection`, `tolerance_beyond_search_range`,
`insufficient_data_coverage` when applicable.

---

## Simulation block (tooltips in A and D)

| Field                                         | Meaning                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `simulation.event`                            | always `uncovered_obligation`; every probability declares its event |
| `simulation.horizon_days`                     | horizon the frequency refers to                                     |
| `simulation.gap_frequency` · `ci95`           | share of verification worlds with a gap, Wilson 95% interval        |
| `simulation.gap_frequency_by_horizon`         | same share within 30, 60 and 90 days                                |
| `simulation.mean_gap_cents` · `p95_gap_cents` | size of the shortfall over all worlds                               |

---

## Degradation (PRD §5.5)

The four fallback files under `apps/web/public/states/` are full state documents
with the same schema. Nearest-state selection uses `parameterization`:

| File              | `parameterization`                                                          |
| ----------------- | --------------------------------------------------------------------------- |
| `base.json`       | `action = none`, no stress                                                  |
| `tension.json`    | `accept_project`, `collection_delay_days = 16`                              |
| `crisis.json`     | `accept_project`, `collection_delay_days = 16`, `main_customer_lost = true` |
| `reinforced.json` | `accept_project`, `collection_delay_days = 16`, `advance_pct = 25`          |

They regenerate byte for byte with `python scripts/generate_states.py --check`.

---

## Verification

```sh
cd services/engine
python3 -m pytest -q tests/test_module_contract.py   # one test per module, over the four fixtures
python3 scripts/generate_states.py --check           # report figures and byte-identical fixtures
```
