# PRD — MVP Structural Fragility Engine for SMEs

**Product:** Bankruptcy Prevention Dashboard for SMEs
**Date:** 12 September 2026
**Context:** Hackathon — scope sized to the remaining hours
**Reference documents:** `product-vision.md`, `evaluation-report.md`, `architecture.md`

---

## 1. Product vision

> **Before you make a decision, find out which part of your company would weaken,
> what event could break it, and what minimum action reinforces it.**

The MVP delivers an interface that turns the structural fragility computation into
three answers an SME owner understands without financial training:

1. **How long can I hold out?** → Weeks of survival.
2. **What if...?** → Decision simulator with the user's own figures.
3. **Why, and what do I do?** → Tension attribution and minimum reinforcement.

The user **enters their own numbers**: how much they will invest, what collection
terms they have, how many people they hire. The engine computes on those values
live, not over a catalogue of prepared cases.

The mathematical complexity — Monte Carlo, calibration, confidence intervals —
stays hidden unless the user explicitly asks for it. The goal is to avoid
cognitive fatigue and allow judges to scan quickly, while keeping strict visual
uniformity.

The engine behind the interface is the **deterministic financial engine plus the
Monte Carlo simulation**: the two components of the current delivery that are
implemented, tested and reproducible.

---

## 2. What is proven and what is not

Mandatory reading before writing any interface or pitch copy.

### 2.1 We can claim it

| Claim | Backing |
| --- | --- |
| The deterministic engine identifies the first uncovered obligation and its date | `evaluation-report.md` §3; 30 engine tests |
| With an additional 16-day collection delay, the payroll on day 75 is uncovered by $40,000 | Report §3, deterministic case |
| A 25% advance ($200,000) reduces gap frequency to 4.6% across 20,000 futures | Report §3, independent verification |
| Intuitive actions can make the outcome worse (staggered purchase: 61.1% of gaps) | Report §3 |
| CatBoost ranks bankruptcy risk better than logistic regression on the Polish benchmark (AP 0.814–0.845 vs 0.685–0.724) | Report §1 |
| The model is fragile under missing data (AP falls from 0.838 to 0.491 with 10% hidden) | Report §2 |

### 2.2 We cannot claim it

| Forbidden claim | Reason |
| --- | --- |
| Any topological / TDA index or figure | Not computed or validated in this delivery |
| "Predicts bankruptcies in Mexico" | No validation on a Mexican population |
| "Predicts payroll shortfalls" | The model is not trained for that event |
| "90% precision" | Alert precision is 86.6–91.8% **while missing** 29–45% of events |
| "Prevents bankruptcies" | No prospective evidence on the effectiveness of recommendations |
| Calibrated probabilities ("a 20% happens 20% of the time") | Report §1: sigmoid calibration worsens Brier in Poland |

**Implementation:** these restrictions are enforced as code, not as a footnote.
See Module E (§3.5), the `warnings` rule (§5.3) and the integrity criteria (§8).

---

## 3. Functional scope

Single view, horizontal cards stacked in a vertical reading sequence, each with
its content laid out left to right.

```
┌─────────────────────────────────────────────────────────────┐
│ A · SURVIVAL INDICATOR                                      │
├─────────────────────────────────────────────────────────────┤
│ B · SANDBOX SIMULATOR — decision, parameters and stress     │
├─────────────────────────────────────────────────────────────┤
│ C · TENSION AND ATTRIBUTION RADAR                           │
├─────────────────────────────────────────────────────────────┤
│ D · MINIMUM REINFORCEMENT AND PROPAGATION PATH              │
├─────────────────────────────────────────────────────────────┤
│ E · Scope and limitations strip                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.1 Module A — Survival Indicator

**Purpose:** answer "how long can I hold out?" in under two seconds of reading.

**Formal definition**, required for the number to be defensible:

> **Weeks of Survival** = whole weeks between the cut-off date and the first
> obligation that goes uncovered, along the deterministic path of the evaluated
> scenario, with no random shock. If no gap appears within the 180-day horizon,
> report `> 25 weeks`, which is the bound the horizon allows us to assert.

This definition must appear in a tooltip. A large number without a definition is
exactly the kind of figure a judge asks you to justify.

**UI elements (left → right):**

| Position | Content |
| --- | --- |
| Left | Hero type: number of weeks. Colour indicator bar to its left |
| Centre | State label: `Estable` · `Tensión` · `Crisis Estructural` |
| Right | Dynamic explanatory text + first obligation at risk, with date and amount |

**Dynamic text per state** — copy is written in Spanish, as with all
user-facing strings:

- **Stable, no decision applied:** "Operación actual, sin el proyecto en
  evaluación. Introduce una decisión para ver su efecto."
- **Stable, decision applied:** "Ninguna obligación queda descubierta en el
  horizonte de 180 días."
- **Tension:** "La nómina del {fecha} queda descubierta por {monto}. Hay margen
  para reforzar."
- **Crisis:** "La nómina del día {n} queda descubierta por {monto}. Se requiere
  acción."

**Rule:** the text always names the **concrete obligation**, never a generic
adjective. "Tu nómina del 26 de noviembre" drives action; "riesgo elevado" does
not.

---

### 3.2 Module B — Sandbox Simulator

**Purpose:** let the user introduce a decision **with their own figures** and
stress it.

Three blocks, left to right.

#### Block 1 — Decision selector

Five decisions, taken from `product-vision.md` §8:

| Decision | Editable parameters |
| --- | --- |
| **Accept project** | Total revenue · initial cost · advance % · collection days · hires · duration |
| **Extend customer credit** | Amount · collection days · whether it is the main customer |
| **Hire staff** | Headcount · monthly unit cost · start date |
| **Buy inventory or machinery** | Amount · % financed · financing term · delivery days |
| **Request financing** | Amount · annual rate · term in months · grace period |

`Accept project` is the default: it is the demo case of `product-vision.md` §12
and the one the evaluation report backs.

#### Block 2 — Decision parameters

The form is **generated from the action schema**
(`contracts/actions.schema.json`); it is not hand-written per decision. Each
parameter declares its type, bounds, default value and marks.

Supported types: `money` (currency-masked input), `percentage` (slider), `days`
(slider), `integer` (stepper), `date` (picker).

Defaults reproduce the report scenario: revenue $800,000, initial cost $380,000,
advance 0%, collection at 60 days, 2 hires. A judge who touches nothing sees
exactly the documented case.

#### Block 3 — Stress controls

Applied on top of any decision:

| Control | Type | Range | Fixed mark |
| --- | --- | --- | --- |
| Collection delay | Slider | +0 to +60 days | **16 days** — *breaking point* |
| Loss of main customer | Toggle | On / Off | — |
| Capital injection | Slider | $0 to $400,000 MXN | **$200,000** — *minimum reinforcement* |

**The marks are figures from the report, not decoration.** Having the user see
the threshold and cross it with their own finger is more persuasive than any
animation. Crossing 16 days drops Module A to `Tensión`; enabling customer loss
escalates to `Crisis`; reaching the reinforcement returns to `Estable`.

#### Controls

**Primary button:** `Ejecutar Simulación`. The computation also fires on control
release, with 400 ms of debounce and cancellation of the previous request.

**Secondary button:** `Restablecer` returns to the schema defaults.

**Loading state:** skeletons in A, C and D. If the response takes longer than
three seconds, the degradation in §5.5 applies.

---

### 3.3 Module C — Tension and Attribution Radar

**Purpose:** explain **what** weakens the structure, without exposing raw
mathematics.

**What it shows:** horizontal bars of tension load per factor, grouped by the six
stacks of the universal graph (`product-vision.md` §5). Grouping by stack
preserves the product's structural narrative without the cost of building the 3D
visualization.

**Definition**, required in a tooltip:

> Tension = 1 − (available margin ÷ reference range), clamped to [0, 1]

It is a **normalization of univariate tolerances**, not a learned causal
attribution. The tooltip must say so in those words.

The margin can be negative — an uncovered obligation has a negative margin — and
in that case tension saturates at 1.00. That is the correct reading: a payroll
that is not covered is maximum tension, not medium tension.

**Parameters per factor.** Without this table the bars are not reproducible:

| Factor | Stack | Available margin | Reference range | Source of the range |
| --- | --- | --- | --- | --- |
| Payroll coverage | People | Available balance − obligation | Payroll amount | Documented |
| Average collection period | Finance | Contracted term − average collection | Contracted term | `product-vision.md` §12 |
| Collection delay tolerance | Sales | Days until the first gap | 60 days | Control range |
| Cost increase tolerance | Operations | Percentage points until the gap | 20 pp | **Declared assumption** |
| Sales drop tolerance | Sales | Percentage points until the gap | 20 pp | **Declared assumption** |
| Main customer concentration | Sales | 1 − concentration | 1.00 | Documented |

The two ranges marked as a declared assumption are exactly that: assumptions, not
measurements. They must appear as such in the tooltip, just as the evaluation
report declares its own.

**Verification against the documented scenario** — project accepted, 16-day
delay, payroll of $120,000 uncovered by $40,000, collection at 45 days against a
60-day term, 46% concentration:

| Factor | Computation | Tension |
| --- | --- | --- |
| Payroll coverage | 1 − (−40,000 ÷ 120,000) → saturated | **1.00** |
| Average collection period | 1 − (15 ÷ 60) | **0.75** |
| Collection delay tolerance | 1 − (16 ÷ 60) | **0.73** |
| Cost increase tolerance | 1 − (7.0 ÷ 20) | **0.65** |
| Sales drop tolerance | 1 − (10.0 ÷ 20) | **0.50** |
| Main customer concentration | 1 − (0.54 ÷ 1.00) | **0.46** |

**Order:** descending by tension, always. The uncovered obligation heads the
chart, which is exactly what the user needs to read first.

**Colour:** blue → orange → red scale by tension. No yellows.

---

### 3.4 Module D — Minimum Reinforcement and Propagation Path

**Purpose:** close the loop. An interface that explains the problem and leaves
the user without a way out does not fulfil the product promise.
`product-vision.md` §9 identifies the counterfactual as *"probably the most
valuable part for the user"*.

**Left half — Minimum Reinforcement (counterfactual):**

```
Recommended action:  Request a 25% advance ($200,000)

                          Before          After
Gap frequency             {n}%     →      {n}%
Weeks of survival         {n}      →      {n}
State                   Tensión    →     Estable
```

The reinforcement **is computed for the current parameterization** through the
engine's one-percentage-point grid search, with the condition that the Wilson
upper bound stay below 5%. It is not copied between scenarios: a $1,200,000
project demands a different reinforcement than an $800,000 one.

Both columns come from the same parameterization with and without the
reinforcement, over the same Monte Carlo worlds. Comparing different worlds would
invalidate the comparison.

**Right half — Propagation Path:**

```
Delivery  →  Invoice  →  Collection  →  Cash  →  Payroll
                              ▲                     ▲
                          is delayed          goes uncovered
```

The origin node and the breaking node are highlighted. No physics, no 3D: five
`<div>` elements with a CSS transition. It is 80% of the narrative impact of a
three-dimensional structure at 5% of the implementation cost.

**Below it, the one-sentence explanation** (`product-vision.md` §11):

> "El cobro llega el día 80, después de la nómina del día 75. Faltan $40,000.
> Un anticipo de $200,000 elimina esta brecha en este escenario."

**Rule:** this sentence is composed from response fields; it is never hard-coded.
If the user changes a parameter and the sentence does not change, the judge will
notice.

---

### 3.5 Module E — Scope and Limitations Strip

**Purpose:** declare the limits of what the system demonstrates. To a technical
jury, a team that declares its limits conveys more rigour than one that hides
them. It is also the mechanism that protects against the forbidden claims in
§2.2.

**Format:** discreet horizontal strip at the foot. Fixed height of 56 px, small
type, reduced contrast.

**Base content:**

```
Escenario sintético en MXN · Sin validación en población mexicana ·
Resultados de benchmark, no operación real · Semilla 42 · Motor v1.0
```

**Dynamic chips:** the `warnings` from the response render here automatically.

**Abstention state:** if the engine returns `abstention` due to insufficient data
coverage — more than 20% unknown variables, report §2 — the strip becomes
prominent and Modules A, C and D dim, showing:

> "Cobertura de datos insuficiente. No se emite estimación."

This is a domain rule, not an interface decision. It is specified in
`architecture.md` §6.3 and the front-end must honour it.

**Approximate-scenario chip:** when the degradation in §5.5 applies, it appears
here and not in the main modules.

---

## 4. Interface requirements (UX/UI)

### 4.1 Horizontal composition

- Every card is horizontal, full width, between 160 and 320 px tall.
- Internal content flows left to right.
- **Vertical grids and stacked square cards that break the reading flow are
  prohibited.**
- Container max width: 1440 px, centred.
- Below 900 px the cards stack internally, but the A → B → C → D hierarchy is
  preserved.
- Module B may be taller because of its three blocks, while remaining horizontal.

### 4.2 Palette — no yellows

Financial health states transition from cool tones (blues/greens for "Estable")
to warm alert tones (oranges/reds for "Tensión/Crisis"). **The use of yellow
tones in any component, metric or alert is strictly prohibited.**

Operationally: **no colour with a hue between 40° and 75°**.

```css
:root {
  /* States */
  --state-stable-strong: #0F9D7A;  /* teal green, hue 166° */
  --state-stable-soft:   #1E6FD9;  /* blue,       hue 213° */
  --state-tension:       #E8622A;  /* orange,     hue  17° */
  --state-crisis:        #C62431;  /* red,        hue 355° */
  --state-crisis-deep:   #8E1620;

  /* Tension scale — Module C */
  --tension-0: #1E6FD9;
  --tension-1: #5B7FC7;
  --tension-2: #A87A8E;
  --tension-3: #D66A52;
  --tension-4: #E8622A;
  --tension-5: #C62431;

  /* Neutrals */
  --surface:    #FFFFFF;
  --background: #F4F6F9;
  --border:     #DDE3EB;
  --text:       #14202E;
  --text-soft:  #5A6B7D;
}
```

**Automated verification:** a test that walks the tokens and fails if any hue
falls in [40°, 75°]. Ten lines, and it turns the rule into something that does
not depend on anyone's memory at 3 a.m. The palette is passed explicitly to any
charting library, which tends to include amber by default.

### 4.3 Typography and data formatting

- **Title Case is mandatory** for names, surnames and professional titles.
  Required examples in the interface: *Director General*, *Gerente Financiero*,
  *Director De Operaciones*, *Responsable Financiero*.
- Implementation: a `titleCase()` utility applied in the rendering component,
  with an exception list for particles (`de`, `del`, `la`, `y`). Data is **not**
  trusted to arrive already capitalized.
- Currency: `$660,000 MXN`, thousands separator, no decimals above $1,000.
- Money inputs use a currency mask and validate against the bounds in the action
  schema.
- Percentages: one decimal (`46.9%`). Confidence intervals appear only in
  tooltips, never in the headline figure.
- Hero type (Module A): 72–96 px, weight 600, tabular numbers.

### 4.4 Animation

- State transition: 400–600 ms, `ease-out`.
- Module C bars animate their width and reordering, not their opacity.
- Module A's week count animates with a count-up between values.
- Module D's path propagates the highlight left to right with 120 ms of delay
  between nodes. It is the highest-impact narrative animation in the MVP and
  takes priority over any other.
- `prefers-reduced-motion` is honoured.

---

## 5. Data contracts

### 5.1 The request

The analysis is requested via `GET`, with every parameter in the query string.
The engine response is deterministic given a fixed seed, so **it is cacheable**:
the same parameterization always returns the same document.

```
GET /v1/analysis
  ?action=accept_project
  &total_revenue_cents=120000000
  &initial_cost_cents=38000000
  &advance_pct=0
  &collection_days=60
  &hires=2
  &collection_delay_days=16
  &main_customer_lost=false
  &capital_injection_cents=0
  &paths=5000
  &seed=42
```

### 5.2 The state document

A single schema for the API response and for the fallback states.

```json
{
  "schema": "v1",
  "state_id": "tension",
  "company_id": "co_demo_agency",
  "cutoff_date": "2026-09-12",
  "currency": "MXN",
  "seed": 42,
  "engine_version": "1.0.0",

  "parameterization": {
    "action": "accept_project",
    "total_revenue_cents": 80000000,
    "initial_cost_cents": 38000000,
    "advance_pct": 0,
    "collection_days": 60,
    "hires": 2,
    "collection_delay_days": 16,
    "main_customer_lost": false,
    "capital_injection_cents": 0
  },

  "survival": {
    "weeks": 10,
    "upper_bounded": false,
    "state": "tension",
    "first_obligation": {
      "kind": "payroll",
      "day": 75,
      "date": "2026-11-26",
      "gap_cents": 4000000
    }
  },

  "simulation": {
    "paths": 5000,
    "gap_frequency": null,
    "ci95": [null, null],
    "mean_gap_cents": null,
    "p95_gap_cents": null
  },

  "tension": [
    {"factor":"payroll_coverage","stack":"people","margin_cents":-4000000,
     "range_cents":12000000,"tension":1.00,"label":"Cobertura De Nómina"},
    {"factor":"average_collection_period","stack":"finance","margin_days":15,
     "range_days":60,"tension":0.75,"label":"Plazo Promedio De Cobro"},
    {"factor":"collection_delay_tolerance","stack":"sales","margin_days":16,
     "range_days":60,"tension":0.73,"label":"Retraso En Cobranza"},
    {"factor":"cost_increase_tolerance","stack":"operations","margin_pp":7.0,
     "range_pp":20.0,"tension":0.65,"label":"Incremento De Costos"},
    {"factor":"sales_drop_tolerance","stack":"sales","margin_pp":10.0,
     "range_pp":20.0,"tension":0.50,"label":"Caída De Ventas"},
    {"factor":"main_customer_concentration","stack":"sales","margin":0.54,
     "range":1.00,"tension":0.46,"label":"Concentración De Clientes"}
  ],

  "propagation_path": {
    "nodes": ["delivery","invoice","collection","cash","payroll"],
    "origin_node": "collection",
    "breaking_node": "payroll"
  },

  "minimum_reinforcement": {
    "kind": "advance",
    "percentage": 25.0,
    "amount_cents": 20000000,
    "gap_frequency_after": null,
    "weeks_after": 25,
    "upper_bounded_after": true,
    "state_after": "stable"
  },

  "explanation": "El cobro llega el día 80, después de la nómina del día 75. Faltan $40,000. Un anticipo de $200,000 elimina esta brecha en este escenario.",

  "warnings": [
    "synthetic_assumptions",
    "no_mexico_validation",
    "declared_reference_range",
    "monte_carlo_excludes_distribution_error"
  ]
}
```

Note that field names are English and `label` values are Spanish: the contract is
the language boundary.

Fields set to `null` are computed by the engine. **They are never filled in by
hand**: the reported figures correspond to zero days of delay, and this
parameterization carries sixteen.

### 5.3 Contract rules

1. **Money in cents, integer.** Never floats crossing a boundary.
2. **`seed` is explicit in the request.** It is part of the cache key: without it
   the response would not be a pure function of the parameters.
3. **The front-end does not compute figures.** It selects, formats and presents.
   It does not derive states, interpolate values, or round in a way that changes
   a number.
4. **`warnings` are always rendered.** A non-empty array that does not appear on
   screen is a defect, not an aesthetic omission.
5. **`schema` is versioned.** An unknown schema is a visible failure, never a
   silent zero.
6. **`tension[]` travels with its inputs** — margin and range — not only with the
   result. That lets the tooltip show the computation and makes the figure
   auditable.

### 5.4 The four fallback states

Generated in phase 0 by running the engine over the scenario in report §3 —
opening balance $660,000, project of $800,000, costs $560,000, horizon 180 days,
seed 42 — and versioned under `apps/web/public/states/`.

**They are not four actions: they are four parameterizations.** This is the
correction that prevents internally contradictory states.

| State | Action | Delay | Customer lost | Advance | Weeks | Label |
| --- | --- | --- | --- | --- | --- | --- |
| `base` | none | 0 d | No | — | > 25 | Estable |
| `tension` | accept_project | 16 d | No | 0% | 10 | Tensión |
| `crisis` | accept_project | 16 d | **Yes** | 0% | to compute | Crisis Estructural |
| `reinforced` | accept_project | 16 d | No | **25%** | > 25 | Estable |

Each control does something distinct and visible: crossing 16 days moves `base`
to `tension`; enabling customer loss escalates to `crisis`; reaching a 25%
advance returns to `estable`.

**Mandatory phase 0 procedure**, in this order:

1. **Validate.** Run the engine at zero delay and confirm it reproduces the
   figures in the report: 0.0%, 46.9%, 25.6% and 4.6%. This is the proof that
   the engine is correctly calibrated.
2. **Generate.** Run the four parameterizations in the table and write the
   documents with the resulting figures.

**Copying figures from step 1 into step 2 is the mistake to avoid.** The report's
figures are at zero delay; the states' figures are at sixteen.

### 5.5 Degradation

The demo cannot depend on the network cooperating.

| Situation | Behaviour |
| --- | --- |
| Initial load | Immediate render of the `base` state, without waiting for the network |
| Response under 3 s | Exact figures for the parameterization |
| Timeout, 5xx or network down | Nearest fallback state + *Escenario aproximado* chip in Module E |
| Response with `abstention` | Modules A, C and D dimmed; strip becomes prominent |

The fallback **does not invent**: it shows a real precomputed state and declares
it as such. That is preferable to a blank screen in front of the jury.

---

## 6. Technical stack

| Layer | Choice |
| --- | --- |
| Front-end | **Vite + React + TypeScript**, static build to S3 + CloudFront |
| Domain | **Go** — `scenario` (the five actions, seed, validation) and `risk` (abstention, projection) |
| Engine | **Python + NumPy** — `cash`, `simulation`, `tension` |
| Edge | CloudFront with response caching + API Gateway HTTP API |
| Infrastructure | AWS serverless, Terraform, CI/CD with GitHub Actions and OIDC |

Go takes what has business invariants and does not exist yet. Python keeps what
is already written and covered by 30 engine tests: rewriting it would be pure
cost.

Full detail is in `architecture.md`.

---

## 7. Execution plan

Every phase leaves something demonstrable. If time runs out, cut from the bottom.

| Phase | Work | Demonstrable |
| --- | --- | --- |
| **0** | Fixtures with seed 42; contract and action schemas | Figures citable against the report |
| **1** | Terraform: site, API, compute, OIDC; end-to-end "hello world" | The pipeline deploys |
| **2** | `tension` in Python; engine Lambda handler | The engine answers one parameterization |
| **3** | Go: `scenario` with `accept_project`, `risk`, projector | **The API returns a real state document** |
| **4** | Front-end: four cards, generated form, degradation | **End-to-end demo** |
| **5** | The other four decisions | Coverage of the product narrative |
| **6** | Caching, warming, slider marks | Robust demo |
| **7** | Animation polish and limitations strip | Finish |

**The point of no return is phase 4.** Decisions 2 through 5 are additive: if time
gets tight, present with a single parameterizable decision and the demo works
just as well.

**Freeze:** two hours before the pitch, `main` is not touched. The team rehearses,
and the rehearsal populates the CloudFront cache with the pitch's paths.

---

## 8. Acceptance criteria

### Functional

- [ ] The view loads in the `base` state in under 2 seconds, without waiting for the network.
- [ ] Changing the project's total revenue produces different figures in A, C and D.
- [ ] Moving the delay slider to 16 days transitions Module A to `Tensión`.
- [ ] Enabling loss of the main customer escalates to `Crisis Estructural`.
- [ ] Raising the capital injection to $200,000 returns to `Estable`.
- [ ] Module C bars reorder by descending tension on every change.
- [ ] Module D's path animates the propagation left to right.
- [ ] The natural-language explanation changes with every parameterization.
- [ ] `Restablecer` returns to the schema defaults.
- [ ] With the network disconnected, the interface still responds using the fallback and says so.

### Presentation

- [ ] No card is square or stacked in a vertical grid.
- [ ] No colour token has a hue between 40° and 75° (automated test).
- [ ] Every name, surname and professional title renders in Title Case
      (*Director General*, *Gerente Financiero*).
- [ ] The limitations strip is visible in every state.

### Integrity

- [ ] No number on screen lacks an engine run behind it.
- [ ] Every Module C bar exposes its margin and range in the tooltip.
- [ ] The two assumed reference ranges are declared as such.
- [ ] The words "topológico", "TDA" or "persistencia" do not appear in the interface.
- [ ] None of the forbidden claims in §2.2 appears.
- [ ] Fixtures regenerate byte-for-byte with seed 42.
- [ ] The validation-step figures match `evaluation-report.md`.

---

## 9. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| **Five decisions do not fit the time available** | **High** | Shared `Action` interface and generated forms; finish `accept_project` completely before starting the second |
| Engine cold start | Medium | CloudFront caching, post-deploy warming, degradation to fallback |
| Time runs out before Module D | Medium | It is phase 4; it takes priority over any polish |
| Figures on screen do not match the report | Medium | `data` gate in CI with golden fixtures |
| The `null` fields of the states get filled in by hand | Medium | Explicit review: the report's values are at zero delay |
| A yellow slips in through a charting library | Medium | `palette` gate in CI + palette passed explicitly |
| A judge asks how a Module C bar is computed | **High** | The §3.3 table and the margin/range tooltip answer the question |

---

## 10. Out of scope

From `product-vision.md`, explicitly **not** built in this MVP:

- 3D visualization of the structure (replaced by Module D's path).
- Persistent homology and topological features.
- Learned Bayesian propagation network.
- Anomaly and regime-change detection.
- The CatBoost model in the interface — the MVP shows the deterministic engine
  and Monte Carlo, the components proven for this scenario.
- Banking connectors, CFDI import, multi-source reconciliation.
- User authentication.
- More than one demo company.
- The six complete stacks with 20–30 navigable nodes.
- Persistence of scenarios between sessions.

Each of these is documented in `product-vision.md` as part of the complete
product. They are out of the MVP because of time, not because they were
discarded.
