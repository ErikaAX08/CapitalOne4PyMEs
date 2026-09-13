# Data model — entity-relationship design

Persistence model for the structural fragility engine. It answers two questions
the code alone does not: **what does the database look like** when the product
moves past the stateless MVP, and **what is the shape of one SME cash movement**
that the engine consumes.

Status: `movements` is **deployed** on Tiger Cloud — PostgreSQL with the
TimescaleDB extension — and read and written by `services/domain` through
`GET`/`POST /v1/movements`. Everything else in the system stays on AWS, so no
RDS or Aurora is involved and `architecture.md` decision 10 (no database inside
AWS) still holds. The remaining tables are created by the same DDL but no code
writes to them yet.

The analysis path is unchanged: the engine is still a pure function of its
request, and the `company` block of that request
(`contracts/engine-request.schema.json`) is exactly a projection of the tables
below. The DDL lives in `contracts/database/schema.sql`.

---

## 1. Design rules

Inherited from `AGENTS.md`, the evaluation report §5 and the engine invariants.

| Rule | Where it lands |
| --- | --- |
| Money is an integer count of cents | every `*_cents` column is `BIGINT`; no `NUMERIC`, no floats |
| An unknown balance is never zero | `company_snapshots.opening_balance_cents` is `NULL`-able; `NULL` counts against coverage and forces abstention |
| No future information from the cut-off | `movements.known_at` and `movements.available_at` stamp when a fact became knowable; historical runs filter on them |
| Duplicates are excluded, conflicts are errors | `UNIQUE (company_id, source, source_ref, due_date)` on `movements`; `due_date` is in the key only because TimescaleDB requires the partition column in every unique index, so the index alone no longer catches a re-import under a corrected date — `internal/movements/application` rejects that before inserting |
| Reconciliation is explicit | `0 <= settled_cents <= amount_cents` as a `CHECK`; status is derived, never typed by hand |
| Every relationship declares its provenance | `provenance` enum `known · declared · learned · hypothetical` on rules and movements |
| A committed scenario is immutable, seed fixed at creation | `scenarios` rows are insert-only; `parameter_hash` makes them addressable and cacheable |
| Every probability declares event and horizon | `analysis_runs` stores `event` and `horizon_days` next to the frequency |
| Alerts are keyed by company + obligation + episode | `alert_episodes` (report §5, "repeated alerts") |
| Recommendations are tracked to their outcome | `recommendations` and `outcome_events` (report §5, "effect of the recommendations") |

Identifiers are ULIDs stored as `CHAR(26)`. Dates relative to a cut-off are
computed, never stored: the database stores calendar dates and the engine
converts them to day offsets at request time.

---

## 2. Entity-relationship diagram

```mermaid
erDiagram
    companies ||--o{ company_snapshots : "observed at a cut-off"
    companies ||--o{ counterparties : "customers, suppliers, lenders"
    companies ||--o{ recurring_rules : "base calendar"
    companies ||--o{ movements : "dated obligations and receipts"
    companies ||--o{ scenarios : "decisions evaluated"
    companies ||--o{ alert_episodes : ""
    companies ||--o{ outcome_events : "observed events for validation"

    graph_nodes ||--o{ recurring_rules : "node"
    graph_nodes ||--o{ movements : "node"
    counterparties |o--o{ movements : "counterparty"
    counterparties |o--o{ recurring_rules : "counterparty"
    recurring_rules |o--o{ movements : "expanded from"

    company_snapshots ||--o{ scenarios : "profile used"
    scenarios ||--o{ analysis_runs : "engine executions"
    analysis_runs ||--o{ tension_factors : "six factors"
    analysis_runs ||--o| recommendations : "minimum reinforcement offered"
    movements |o--o{ alert_episodes : "obligation at risk"
    movements |o--o{ outcome_events : "obligation that went uncovered"

    companies {
        char26 company_id PK
        text name
        text vertical "b2b_services | wholesale | manufacturing"
        char3 currency "MXN"
        smallint payroll_interval_days
        int project_delivery_day
        bigint hire_monthly_cost_cents
        timestamptz created_at
    }

    company_snapshots {
        char26 snapshot_id PK
        char26 company_id FK
        date cutoff_date
        bigint opening_balance_cents "NULL = unknown"
        bigint payroll_cents "NULL = unknown"
        numeric main_customer_concentration "0..1, NULL = unknown"
        int contracted_term_days
        int average_collection_days
        timestamptz source_synced_at "freshness stamp"
        smallint known_variables
        smallint total_variables
    }

    counterparties {
        char26 counterparty_id PK
        char26 company_id FK
        text kind "customer | supplier | employee | lender | tax_authority"
        text name
        numeric revenue_share "customers only"
        boolean is_main_customer
    }

    graph_nodes {
        text node_id PK
        text stack "finance | sales | operations | people | technology | compliance"
        smallint default_priority
    }

    recurring_rules {
        char26 rule_id PK
        char26 company_id FK
        text node FK
        char26 counterparty_id FK "nullable"
        text direction "in | out"
        bigint amount_cents
        date first_due_date
        smallint interval_days
        text shift "none | delivery | collection"
        text scale "none | sales | cost"
        text exposure "none | main_customer"
        text provenance
        date valid_from
        date valid_to "nullable"
    }

    movements {
        char26 movement_id PK
        char26 company_id FK
        text node FK
        char26 counterparty_id FK "nullable"
        char26 rule_id FK "nullable"
        text direction "in | out"
        date due_date
        bigint amount_cents
        bigint settled_cents "0..amount"
        date settled_at "nullable"
        text status "expected | confirmed | delayed | settled | cancelled"
        date known_at "when the fact became known"
        timestamptz available_at "when it reached us"
        text source "bank | cfdi | manual | rule | action"
        text source_ref "external id for dedup"
        text shift
        text scale
        text exposure
        smallint priority "nullable"
        text provenance
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    scenarios {
        char26 scenario_id PK
        char26 company_id FK
        char26 snapshot_id FK
        text action_kind
        jsonb action_parameters
        int collection_delay_days
        boolean main_customer_lost
        bigint capital_injection_cents
        int seed
        int paths
        int horizon_days
        char64 parameter_hash "UNIQUE, cache key"
        timestamptz created_at
    }

    analysis_runs {
        char26 run_id PK
        char26 scenario_id FK
        text engine_version
        text schema_version
        text status "ok | abstention | error"
        text state_id "stable | tension | crisis | abstention"
        int survival_weeks
        boolean upper_bounded
        text first_obligation_kind
        date first_obligation_date
        bigint first_gap_cents
        bigint net_recurring_flow_cents
        text event "uncovered_obligation"
        int horizon_days
        numeric gap_frequency
        numeric ci95_low
        numeric ci95_high
        bigint mean_gap_cents
        bigint p95_gap_cents
        jsonb state_document "full contract payload"
        text correlation_id
        int duration_ms
        timestamptz computed_at
    }

    tension_factors {
        char26 run_id FK
        text factor PK
        text stack
        numeric margin
        numeric range
        text unit "cents | days | pp | ratio"
        numeric tension "0..1"
        text range_source "documented | control_range | declared_assumption"
    }

    recommendations {
        char26 recommendation_id PK
        char26 run_id FK
        text kind "advance | capital_injection"
        numeric percentage
        bigint amount_cents
        boolean required
        numeric gap_frequency_after
        int weeks_after
        text state_after
        timestamptz offered_at
        boolean accepted "NULL = unknown"
        timestamptz accepted_at
        bigint realized_cost_cents
        text notes
    }

    alert_episodes {
        char26 episode_id PK
        char26 company_id FK
        char26 movement_id FK
        date opened_on
        date resolved_on "nullable"
        text severity "warning | critical"
        smallint streak
        bigint last_sent_gap_cents
        text last_sent_severity
        boolean quality_ok
    }

    outcome_events {
        char26 event_id PK
        char26 company_id FK
        char26 movement_id FK "nullable"
        text kind "payroll_uncovered | negative_balance | emergency_credit | tax_delay | supplier_delay"
        date occurred_on
        bigint amount_cents
        text evidence
    }
```

---

## 3. The movements table

`movements` is the table the engine reads. One row is one dated receipt or
obligation of the SME, in the company's currency, relative to a real calendar
date. The engine turns `due_date − cutoff_date` into the day offset its ledger
uses, and `amount_cents − settled_cents` into the outstanding amount.

| Column | Type | Meaning | Engine field |
| --- | --- | --- | --- |
| `movement_id` | `CHAR(26)` | ULID. Part of the primary key together with `due_date`, which rides along only because it is the partition column | `id` |
| `company_id` | `CHAR(26)` | owner | request `company.company_id` |
| `node` | `TEXT` → `graph_nodes` | capability the movement funds or consumes (`payroll`, `collection`, `supplier`, …) | `node` |
| `counterparty_id` | `CHAR(26)`, nullable | the customer, supplier, lender or authority | — |
| `rule_id` | `CHAR(26)`, nullable | the recurring rule that generated it, if any | — |
| `direction` | `in` / `out` | receipt or commitment | `direction` |
| `due_date` | `DATE` | contractual date | `day = due_date − cutoff_date` |
| `amount_cents` | `BIGINT ≥ 0` | contractual amount | `amount_cents` |
| `settled_cents` | `BIGINT`, `0..amount_cents` | reconciled so far | `settled_cents` |
| `settled_at` | `DATE`, nullable | date of the last settlement | — |
| `status` | enum | `expected · confirmed · delayed · settled · cancelled`, derived by the loader | excluded when `settled` or `cancelled` |
| `known_at` | `DATE` | when the fact became knowable; must be ≤ cut-off to be used | `known_at` |
| `available_at` | `TIMESTAMPTZ` | when it reached the system; report §5 "stale data" | filter for historical simulations |
| `source` | enum | `bank · cfdi · manual · rule · action` | — |
| `source_ref` | `TEXT` | external identifier; `UNIQUE (company_id, source, source_ref)` | dedup |
| `shift` | enum | which stochastic delay moves it: `none · delivery · collection` | `shift` |
| `scale` | enum | which stochastic factor scales it: `none · sales · cost` | `scale` |
| `exposure` | enum | `main_customer` when the amount contains the main customer's share | `exposure` |
| `priority` | `SMALLINT`, nullable | intraday order among commitments; default from `graph_nodes` | `priority` |
| `provenance` | enum | `known · declared · learned · hypothetical` | `provenance` |

**What being a hypertable costs**

`movements` is partitioned by `due_date`, and TimescaleDB enforces uniqueness
per chunk: *"Any `UNIQUE` or `PRIMARY KEY` index must include the partition
column."* Three things follow, and they are the price of the partitioning:

- the primary key is `(movement_id, due_date)`, not `movement_id` alone;
- the dedup index is `(company_id, source, source_ref, due_date)`, so the same
  `source_ref` re-imported under a **corrected date** no longer collides — the
  use case in `services/domain/internal/movements/application` rejects it
  instead, and a concurrent pair of writes could in principle slip past;
- `alert_episodes` and `outcome_events` carry `movement_due_date` next to
  `movement_id`, because a foreign key must reference the whole key.

**Conventions the engine relies on**

- Receipts are applied before commitments on the same day, then by `priority`
  (`materials 10 · hiring 20 · supplier 30 · payroll 40 · debt 50 · tax 60`).
- A movement with `known_at > cutoff_date` is future information and is rejected.
- A movement with `due_date < cutoff_date` and `status ≠ settled` is a past due
  item that must be reconciled before simulating.
- `shift = collection` is what the stress slider *Retraso en cobranza* moves. The
  demo profile applies it to the project's collection only, as the evaluation
  report does; marking base receivables with `shift = collection` extends the
  stress to them.

---

## 4. How the engine request maps to the tables

| Request field | Source |
| --- | --- |
| `company.opening_balance_cents`, `payroll_cents`, `main_customer_concentration`, `contracted_term_days`, `average_collection_days` | `company_snapshots` at `cutoff_date` |
| `company.payroll_interval_days`, `project_delivery_day`, `hire_monthly_cost_cents` | `companies` |
| `company.recurring_rules[]` | `recurring_rules` valid at the cut-off (`first_day = first_due_date − cutoff_date`) |
| `company.one_off_movements[]` | `movements` with `status ∉ {settled, cancelled}`, `rule_id IS NULL`, `known_at ≤ cutoff_date` |
| `action`, `stress`, `seed`, `paths`, `horizon_days` | `scenarios` |
| response | `analysis_runs` (+ `tension_factors`, `recommendations`) |

Coverage is `known_variables / total_variables` over the snapshot's seven
profile variables; above 20% unknown the run is an `abstention`.

---

## 5. What the MVP stores and what it does not

| Now | Later |
| --- | --- |
| `movements` and `graph_nodes` on Tiger Cloud, written by `/v1/movements` | the loaders that fill `movements` from bank feeds and CFDI, instead of by hand |
| Demo profile as a JSON fixture (`company_demo_agency.json`) | `companies`, `company_snapshots`, `recurring_rules`, `counterparties` |
| Four fallback state documents under `apps/web/public/states/` | `scenarios` + `analysis_runs`, keyed by `parameter_hash` (the CloudFront cache key becomes a row) |
| Nothing about alerts or outcomes | `alert_episodes`, `outcome_events`, `recommendations` — the tables the evaluation report §5 says are required before any prospective claim |
| The analysis still builds its request from the fixture, not from `movements` | `company.one_off_movements[]` read from the rows the ledger holds |

Adding the database does not change the engine: `analysis.analyze()` receives
the same request either way. It changes who builds the request.

---

## 6. The historical reference set

`company_snapshots.dataset` names the external set a row came from; `NULL` is
the product's own data. One set is loaded today.

**Source.** The UCI *Polish companies bankruptcy data* (Zieba, Tomczak &
Tomczak), 43,405 company-year observations of 64 financial **ratios** plus a
bankruptcy label, covering 2000-2013. Loaded by
`services/domain/scripts/load_polish_dataset.py`.

| Table | Rows | What they are |
| --- | --- | --- |
| `companies` | 43,169 | `vertical = 'reference_dataset'`, named `PL-<file>-<index>` |
| `company_snapshots` | 43,169 | `dataset = 'uci-polish-bankruptcy'` |
| `movements` | 675,667 | **derived**, `provenance = 'hypothetical'`, `source = 'rule'` |
| `outcome_events` | 2,073 | `kind = 'bankruptcy'` — the only observed event |

**What is observed and what is not.** The set is a reference table, not a
ledger: it has no dates, no individual movements, no counterparties and no
company identity. What it does have is an absolute scale, because `Attr29` is
the base-10 logarithm of total assets — verified self-consistent with
`Attr55 / Attr3` in 97.9% of rows — which lets each ratio be resolved into an
amount.

- **Observed**: `average_collection_days` (`Attr44`, median 54 days) and the
  cash balance (`Attr40 x Attr51 x 10^Attr29`), plus the bankruptcy label.
- **Derived**: every amount in `movements`, from the ratios.
- **Invented**: every `due_date` in `movements`. The source has no dates at
  all; the calendar is a convention, which is why each row is stamped
  `hypothetical` and `rule`. **Never read these as facts the business
  reported.**

**Coverage, and why these companies abstain unless the caller declares the
rest.** `GET /v1/analysis` accepts `payroll_cents`,
`main_customer_concentration`, `contracted_term_days`,
`payroll_interval_days`, `average_collection_days` and
`opening_balance_cents` as optional parameters. A declared value only ever fills
a hole — it never overwrites what the database recorded — and without them a
reference company answers `abstention` at 4/7 coverage.

 Five of the seven
coverage variables of §4 — `payroll_cents`, `payroll_interval_days`,
`main_customer_concentration`, `contracted_term_days` and `recurring_rules` —
are simply absent from the source, so they are `NULL`. That is 71% unknown
against a 20% threshold: the engine abstains on every one of them, and it is
right to. Filling them with plausible values would turn an honest abstention
into a confident answer about a company nobody measured.

**Two distortions to state plainly.**

1. **Currency.** The amounts are Polish zloty, stated in thousands, converted
   at one fixed rate of **1 PLN = 4.5494 MXN** (a 2026 rate applied to
   2000-2013 statements) so they satisfy the `currency = 'MXN'` constraint.
   Every converted figure carries that distortion.
2. **Identity.** The dataset publishes no keys, so rows are never joined across
   its five files. Two rows may be the same firm a year apart and there is no
   way to tell; each is loaded as its own company.

**Rejections.** 236 of 43,405 rows (0.54%) were refused rather than repaired:
135 without sales, 68 implying a negative cash balance, 25 with total assets
outside a credible range, 8 without a scale. A further 542 rows report a
collection cycle longer than a year — `Attr44` reaches 22,584,000 "days" — and
for those the variable is left unknown rather than recorded wrong.

**How the derived calendar is built, and what it took to make it honest.**
Three streams, deliberately disjoint, each spanning the same 180-day horizon so
they can be weighed against one another:

| Stream | Amount | Cadence |
| --- | --- | --- |
| `collection` (in) | the receivables balance, which annualises to sales | the collection cycle, `Attr44` |
| `supplier` (out) | `Attr58 x sales` — everything the business spends | monthly |
| `debt` (out) | long-term liabilities amortised over five years | monthly |

`Attr58` (total costs / total sales) is the anchor because it is the ratio that
decides whether cash accumulates, and it is credible: median 0.939, with 87% of
the set spending less than it sells. The resulting calendar has a median
inflow-to-outflow ratio of 0.91 over the horizon, and 28% of companies generate
cash.

Two earlier attempts did not survive checking, and both are worth recording:

- Charging the payables balance as `supplier`, the inventory balance as
  `materials` and operating expenses as `tax` counted the same money three
  times — outflows ran at 7,637M against 2,661M of inflow, and **every** company
  came out in crisis regardless of its ratios.
- Deriving the cost of sales from `Attr52` as
  `short-term liabilities x 365 / Attr52` yields 352 times sales at the median.
  Whatever that ratio encodes, it is not an annual cost, and it is not used.

**What it does not show.** On a random sample of 25 companies that went bankrupt
and 25 that did not, the state distribution is the same — crisis 12 vs 15,
tension 6 vs 4, stable 6 vs 5. **This calendar does not discriminate
bankruptcy.** Part of the reason is structural: three profile variables must be
declared per request, and declaring one value across companies whose assets span
six orders of magnitude makes that declaration, not the company, drive the
result. Treat these simulations as exercises of the engine over real financial
structure, never as evidence that it predicts failure.

**What it is for.** `outcome_events` is the table the evaluation report §5 says
is required before any prospective claim. This set supplies real outcome
labels — and it is Polish, which is exactly the limitation `/analysis` already
declares on screen as "Sin validación en población mexicana".
