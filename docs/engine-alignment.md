# Engine alignment review — from `motor-pyme-solo-codigo` to `services/engine`

Review of the initial engine delivery against `product-vision.md`, `prd-mvp.md`,
`architecture.md` and `evaluation-report.md`, and the record of how it was
adapted to the planned infrastructure. Date: 12 September 2026.

---

## 1. Verdict

The original engine (`motor.py`, 191 lines, 30 tests) is **correct for what the
PRD claims and reproduces every figure in the evaluation report §3**. It was not,
however, shaped for the architecture: a single script with hard-coded company
figures, floats in pesos, Spanish identifiers, no notion of a request, no
tension module, and a demo scenario that could not be parameterized by the user.

It has been ported to `services/engine` as a package that:

- regenerates the report byte for byte (`tests/test_report_figures.py`, and
  `scripts/generate_states.py` step 1);
- reproduces the PRD §3.3 tension table exactly (1.00 · 0.75 · 0.73 · 0.65 ·
  0.50 · 0.46);
- answers any parameterization of the five decisions in about 50 ms for 5,000
  paths, including the reinforcement grid and the three univariate sweeps;
- produces the four fallback states of PRD §5.4 with the behaviour the PRD
  demands (base → `Estable`, 16 days → `Tensión` at 10 weeks, customer lost →
  `Crisis`, 25% advance → `Estable`).

The CatBoost evaluation scripts (`evaluar.py`, `predecir.py`, `mitigar.py`,
`informe.py`, `verificar_entrega.py`) were **not** ported. PRD §10 and
architecture decision 4 exclude the supervised model from the MVP; they remain in
`motor-pyme-solo-codigo/` as the evidence base behind report §1–2.

---

## 2. Reproduction

Verification worlds, 20,000 futures, seed 782, zero delay — report §3 table:

| Action | Report | Engine |
| --- | --- | --- |
| base | 0 gaps, 0.0% | 0, 0.0% |
| project without reinforcement | 9,380, 46.9%, mean $48,803, p95 $195,558 | identical |
| advance 20% | 1,945, 9.7% | identical |
| advance 40% | 62, 0.3% | identical |
| minimum advance 25% | 916, 4.6%, mean $2,085 | identical |
| breaking point | 16 days, payroll day 75, $40,000 | identical |
| sales drop / cost increase tolerance | 10.0 pp / 7.0 pp | identical |

The one-percentage-point grid on search worlds (seed 781) selects 25.0% as the
report states. `staggered_purchase`, `gradual_hiring` and `milestones` are report
comparisons, not PRD decisions, and were not carried into the action set; the
original script remains the reference for them.

---

## 3. Does the model produce what the product needs?

Mapping of the PRD state document (§5.2) to its source in the engine.

| State document field | Source | Status |
| --- | --- | --- |
| `survival.weeks`, `first_obligation{kind, day, date, gap_cents}` | deterministic path, `analysis._survival` | existed; formalised (weeks = day ÷ 7, `> 25` when no gap in 180 days) |
| `survival.state` | rule in §4.3 below | **new — the PRD had no formal definition of `Crisis`** |
| `simulation.gap_frequency`, `ci95`, `mean_gap_cents`, `p95_gap_cents` | Monte Carlo on verification worlds | existed |
| `simulation.gap_frequency_by_horizon{30,60,90}` | first-gap day ≤ horizon | **new** — vision §7 events 1–2 by horizon; every probability now declares `event` and `horizon_days` (architecture §6.3) |
| `tension[]` six factors with margin and range | `engine/tension` | **new module** (PRD phase 2) |
| `minimum_reinforcement` with before/after on the same worlds | grid search + verification | existed for the advance; **new** fallback to a capital-injection grid for the other four decisions and for cases no advance can fix |
| `propagation_path{nodes, origin_node, breaking_node}` | `engine/graph.path_to` | existed; origin now depends on the stress or action |
| `explanation` | composed from response fields | **new**, never hard-coded |
| `warnings` | `projection._warnings` | **new**; four base warnings plus conditional ones |
| `coverage` and `abstention` | `CompanyProfile.coverage` | **new**; >20% unknown profile variables → abstention (report §2) |

Everything the four cards render has an engine run behind it. The field-by-field
contract per module is `docs/module-contract.md`, enforced by
`tests/test_module_contract.py`.

---

## 4. Decisions taken where the documents were silent or inconsistent

### 4.1 Parameter semantics for `accept_project`

The report's scenario is: delivery day 30, collection 30 days later (day 60),
$380,000 of materials on day 0, $90,000 on days 30 and 60. The PRD lists the
editable parameters as revenue, initial cost, advance, collection days, hires and
duration, but the contract in §5.2 omits duration. The mapping that reproduces
the report with the PRD defaults is:

| Parameter | Default | Meaning in the calendar |
| --- | --- | --- |
| `collection_days` | 60 | day, from the decision, on which the balance is nominally collected; exposed to delivery and collection delays |
| `duration_days` | 30 | day of delivery and invoicing (optional; not part of the cache key when omitted) |
| `hires` | 2 | project staff, paid monthly at `hire_monthly_cost_cents` ($45,000) on days 30, 60, … until collection |
| `initial_cost_cents` | $380,000 | materials on day 0, scaled by the cost shock |

Two hires at $45,000 for two months are the report's two payments of $90,000.
The staff cost running until collection is a declared assumption and is stated
as such in the action schema hint.

### 4.2 The explanation sentence

PRD §3.4 quotes *"El cobro llega el día 80"*. That figure comes from the
report's demo run at **+20 days**; the `tension` state is at **+16 days**, where
the collection arrives on **day 76**. The engine composes the sentence from
fields, so the fixture reads *día 76*. The PRD example should be corrected; the
rule "never hard-code the sentence" is what protects the demo here.

### 4.3 `Estable · Tensión · Crisis Estructural`

The PRD names the states and gives their triggers by example, but not a rule.
The engine uses one that is deterministic and auditable:

- **stable** — no uncovered obligation in the horizon;
- **tension** — a timing gap: an obligation goes uncovered, the recurring
  operation is cash-positive and the path ends above zero;
- **crisis** — a structural gap: the recurring net flow per 30 days is negative,
  or the path ends negative, or the first uncovered obligation falls within four
  weeks (vision §7, "dropping below four weeks of cash").

With the main customer lost, the demo company's recurring flow is
−$127,200 per 30 days, so the state is `crisis` even though the project's margin
keeps the 180-day ending balance positive. `net_recurring_flow_cents` travels in
the document so the classification can be checked.

### 4.4 The 25% mark

The PRD fixes the advance slider mark at 25% and labels it *refuerzo mínimo*.
That is the minimum at **zero** delay. At 16 days, the engine finds 27% (a 25%
advance leaves 5.5% of futures with a gap, above the 5% Wilson bound), although
the deterministic path is already covered at 25% — which is why the `reinforced`
state is `Estable` as the PRD requires. The mark text in
`contracts/actions.schema.json` now reads *"refuerzo mínimo a 0 días de
retraso"*, and the reinforcement shown in Module D is computed for the current
parameterization, as PRD §3.4 demands.

### 4.5 What the delay slider moves

The report applies the additional delay to the **project's** collection only;
base receipts stay on their dates. The engine keeps that semantics via the
`shift` attribute on movements. Marking the base receivable rule with
`shift: collection` would extend the stress to the whole receivable book; it is
a one-line change in the profile, not in code, and it would change the figures.

### 4.6 `average_collection_period` is static

PRD §3.3 fixes this factor at 0.75 for the 16-day scenario, i.e. computed from
the profile (60-day term, 45-day average) and not moved by the slider. The
engine follows the PRD. Feeding the applied delay into this factor would be more
informative and is a candidate refinement, not a defect.

### 4.7 Money

The original engine worked in floating-point pesos with a $0.005 threshold. The
package works in cents: integer at every boundary, float64 cents inside the
vectorised simulation because the sales and cost shocks are multiplicative, and
a half-cent threshold. The report figures are unchanged.

### 4.8 What was left out on purpose

- `AlertPolicy` (episodes, deduplication, escalation): architecture §6.1 marks
  the `alerts` context out of MVP scope. Its state is modelled in the data model
  as `alert_episodes` so nothing is lost.
- `staggered_purchase`, `gradual_hiring`, `milestones`: report comparisons that
  demonstrate "intuitive actions can make it worse". They are citable from the
  report; they are not user decisions in the PRD.

---

## 5. Where the code landed

```
services/engine/
├── engine/
│   ├── cash/          movements.py (normalize, ledger) · profile.py (CompanyProfile, RecurringRule)
│   ├── simulation/    worlds.py · simulate.py (vectorised) · summary.py · reinforcement.py
│   ├── tension/       sweep.py (breaking points, six factors)
│   ├── actions.py     the five decisions as calendar transformations
│   ├── stress.py      delay · main customer lost · capital injection
│   ├── graph.py       six stacks, implemented edges, propagation path
│   ├── analysis.py    request → result (English, integer cents)
│   ├── projection.py  result → state document (Spanish labels, explanation, warnings)
│   ├── contracts.py   loads contracts/, parses the query string against actions.schema.json
│   └── handler.py     Lambda entry point: lambda:Invoke from Go, or API Gateway GET
├── fixtures/          company_demo_agency.json · states/{base,tension,crisis,reinforced}.json
├── scripts/           generate_states.py (phase 0, --check is the CI data gate) · package_lambda.sh
└── tests/             54 tests: reconciliation, simulation, actions, report figures, contract
```

Contracts added: `contracts/actions.schema.json`, `contracts/state.schema.json`,
`contracts/engine-request.schema.json`, `contracts/database/schema.sql`. Fallback
states published to `apps/web/public/states/`.

---

## 6. Open items for the next phases

1. **Go domain (phase 3).** `scenario` validates the query against
   `actions.schema.json` and builds the engine request; `risk` applies the
   abstention rule and projects the result. `engine/projection.py` is the
   reference implementation the Go projector must match; the contract test
   validates both against `state.schema.json`.
2. **Front-end (phase 4).** `apps/web` still ships a mocked
   `simulateFinancialDecision` with hand-written figures, which violates the rule
   "no number without an engine run". It must be replaced by the four cards
   consuming state documents, with `public/states/` as the fallback.
3. **PRD corrections.** Explanation example (day 76, not 80); the 25% mark is at
   zero delay; formal definition of the three states (§4.3).
4. **Infrastructure (phase 1).** `scripts/package_lambda.sh` builds the arm64 zip
   the `compute` module expects; the handler answers API Gateway directly, so
   the API can be demonstrated before the Go Lambda exists.
