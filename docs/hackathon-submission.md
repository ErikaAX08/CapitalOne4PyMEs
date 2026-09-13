# Stackly — hackathon submission

Draft answers for the submission form. Every figure traces to
`evaluation-report.md`, the seed-42 fixtures, or the code.

---

## Inspiration

An SME can look healthy in its financial statements and be structurally fragile
at the same time. Sales grow, it reports a profit, the balance is positive, it
just won a large project — and yet 46% of its revenue depends on one customer,
it has to finance materials and payroll before collecting, that customer pays at
60 days, and an extra 15-day delay makes payroll impossible to cover.

A traditional financial analysis looks at that project and says *accept*. The
owner finds out it was the wrong answer eleven weeks later, when the payroll is
due.

We didn't want to build another bankruptcy score. We wanted to answer the
question an owner actually asks before signing: **which part of my company would
weaken, what event would break it, and what is the smallest thing I can do to
reinforce it?**

---

## What it does

Stackly turns a business decision — with the owner's own numbers — into four
answers:

- **How long can I hold out?** Weeks of survival, defined precisely: whole weeks
  between the cut-off date and the first obligation that goes uncovered along
  the deterministic path, with no random shock.
- **What breaks first?** The concrete obligation, with its date and its amount.
  Not "elevated risk" — *"la nómina del 26 de noviembre queda descubierta por
  $40,000"*.
- **Why?** A tension radar over six factors (payroll coverage, collection
  period, delay tolerance, cost tolerance, sales-drop tolerance, customer
  concentration), each one carrying its own margin and reference range so the
  number is auditable in a tooltip.
- **What do I do?** The minimum reinforcement, searched on a one-percentage-point
  grid over the same Monte Carlo worlds, plus the propagation path:
  delivery → invoice → collection → cash → payroll.

The user simulates five decisions — accept a project, extend customer credit,
hire staff, buy an asset, request financing — and stresses them with three
controls: collection delay, loss of the main customer, capital injection. The
slider marks are not decoration: **16 days** is the breaking point and **25%
($200,000)** is the minimum reinforcement, both computed by the engine and
traceable to our evaluation report.

On the documented demo scenario — a B2B services agency, $660,000 opening
balance, an $800,000 project costing $560,000:

| | Gap frequency over 20,000 futures |
| --- | --- |
| Current operation | 0.0% |
| Project, no reinforcement | 46.9% |
| Project + 25% advance | 4.6% |
| Project + "staggered purchase" | **61.1%** |
| Project + "gradual hiring" | **61.5%** |

The last two lines are the point. The two reinforcements an owner reaches for
intuitively make the situation *worse*, because they add days and cost to the
delivery. You cannot see that without an engine.

There is a second surface: a **movements ledger** backed by PostgreSQL +
TimescaleDB on Tiger Cloud, and a **company catalog** that lets you analyse
companies from a real historical reference set instead of only the demo profile.

---

## How we built it

```
Browser → CloudFront → API Gateway → Lambda (Go, domain) → Lambda (Python, engine)
```

One property ordered every other decision: **the engine is deterministic given a
fixed seed, so a response is a pure function of its query parameters.** From that
follows everything that made a live backend viable in a hackathon:

- The analysis is a `GET` with every parameter in the query string, so
  **CloudFront becomes a memo table** for the engine. The second visitor to any
  scenario never reaches the computation — 20 ms instead of 400.
- Cold start only ever hits the first visitor to each parameterization, and
  deployment pre-warms the paths the pitch walks through.
- The seed is explicit in the request because it is part of the cache key.

**Go** owns the domain — `scenario` (the five actions, validation, seed), `risk`
(coverage, abstention, projection) and `movements` — in strict hexagonal layers,
with a CI gate that greps `internal/*/domain/` and fails the build if it imports
infrastructure. **Python + NumPy** owns the engine: cash calendar, vectorised
Monte Carlo, reinforcement grid, tension sweep. Roughly 50 ms for 5,000 paths
including the sweeps. **React + TypeScript + Vite** on the front, feature-sliced
with an enforced import direction, a 3D resilience tower on react-three-fiber,
and four precomputed states bundled so the first paint never waits for the
network.

Infrastructure is Terraform on AWS: S3 + CloudFront, API Gateway HTTP API, two
ARM64 Lambdas, GitHub Actions with OIDC and zero static keys, Budgets and alarms.
No VPC, no NAT Gateway, no RDS — **about 1.30 USD/month**. The ledger lives on
Tiger Cloud instead, over TLS, which is how we got a real database without paying
43 USD/month for Aurora.

The rules we refused to bend became CI gates rather than good intentions:

| Gate | Fails the build when |
| --- | --- |
| `data` | Fixtures don't regenerate byte-for-byte with seed 42, or stop matching the evaluation report |
| `contract` | Go or Python emits a document that fails `contracts/state.schema.json` |
| `purity` | A Go domain package imports an adapter or the AWS SDK |
| `palette` | Any colour token has a hue in [40°, 75°] — the product forbids yellows in a financial-state scale |
| `lexicon` | The words "topológico", "TDA" or "persistencia" reach the build, because we did not compute them |

~56 engine tests, 75 Go tests, plus web unit tests and Playwright end-to-end
coverage.

---

## The database: Tiger Cloud

`architecture.md` decision 10 said **no database**. Not because we did not want
state — because the arithmetic killed it. Aurora Serverless v2 without
scale-to-zero is about **43 USD/month**, and putting it somewhere a Lambda can
reach it means a VPC, which means a NAT Gateway at about **32 USD/month**. That
is 75 USD against a total infrastructure bill of **1.30 USD/month**. The
database would have cost fifty-seven times the entire rest of the system.

Tiger Cloud dissolved the trade-off instead of splitting the difference. The one
stateful thing in the architecture lives outside AWS and is reached over TLS
from the Go service, so there is still no RDS, no Aurora, no VPC and no NAT —
and we still got a real PostgreSQL, with everything that implies.

**PostgreSQL 18.6 · TimescaleDB 2.30.0 · us-east-1 · free tier.**

### It is a real schema, not a bucket with a schema's clothes on

All twelve tables of `contracts/database/schema.sql` are deployed, with the
invariants written as constraints rather than as hopes: money as `BIGINT` cents
and never a float, ULIDs as `CHAR(26)`, `settled_cents BETWEEN 0 AND
amount_cents`, a `CHECK` that makes the `settled` status and the reconciliation
agree by definition, partial unique indexes for deduplication, and `NULL`
meaning *unknown* — never zero, because a zero balance is a confident lie and an
unknown one forces the engine to abstain.

| Table | Rows | What they are |
| --- | --- | --- |
| `companies` | 43,171 | the demo profile plus a historical reference set |
| `company_snapshots` | 43,169 | one observation each, at a cut-off date |
| `movements` | 675,690 | 675,667 derived and stamped as such, 23 recorded through the product |
| `outcome_events` | 2,073 | real bankruptcies — the labels temporal validation needs |
| `graph_nodes` | 24 | the SME graph, seeded from `engine/graph.py` |

`movements` is a **hypertable partitioned by `due_date`**, declared inline:

```sql
CREATE TABLE movements (...)
WITH (tsdb.hypertable = true, tsdb.partition_column = 'due_date');
```

It currently holds **54 chunks over 403 MB**, all created by TimescaleDB as the
rows landed. A company's ledger comes back in **90–340 ms** across repeated
calls and a catalogue page in **~480 ms**, measured end to end from a laptop in
Mexico to us-east-1 — most of which is the round trip, not the query.

### The hypertable cost us an invariant, and we wrote that down

This is the part we are proudest of, and it is not a feature.

`data-model.md` §1 declares: *duplicates are excluded, conflicts are errors — a
conflicting re-import is **rejected** by the loader, not merged*, enforced by
`UNIQUE (company_id, source, source_ref)`. TimescaleDB has a rule of its own:
*any `UNIQUE` or `PRIMARY KEY` index must include the partition column*, because
uniqueness is enforced per chunk. The two rules collide head-on. Adding
`due_date` to that index means the same invoice re-imported under a **corrected
date** no longer collides — it silently becomes a second row, which is exactly
the case the document says must be refused.

We found it before shipping, and we did four things instead of one:

1. Put `due_date` in the key, and the primary key with it — the partitioning is
   worth having.
2. Moved the rejection into `internal/movements/application`, which checks the
   external identity before inserting and answers **409** on a conflict.
3. Wrote the test that proves where the guard now lives: it asserts that the use
   case refuses a re-import **and that the database accepts the very same row**
   when inserted through the repository directly.
4. Amended `data-model.md` to say the database no longer guarantees it on its
   own, and that two concurrent writers could in principle slip past.

Two foreign keys followed as consequences — `alert_episodes` and
`outcome_events` now carry `movement_due_date` beside `movement_id`, because a
foreign key must reference the whole key.

The easy version of this story is a schema that looks clean and quietly admits
duplicates. We would rather ship the trade-off with its receipt attached.

### What it actually powers

- **A company catalogue.** `GET /v1/companies` serves more than 43,000
  companies with name search and outcome filters. It is the control in the
  application header: you pick a company and the whole analysis follows it.
- **Profiles that drive the engine.** `PostgresRepository` implements the same
  `CompanyRepository` port the demo fixture does, assembling a profile from
  `companies`, `company_snapshots`, `recurring_rules` and `movements`. Swapping
  a JSON file for a database changed one adapter and nothing above it — the
  hexagonal boundary paid for itself here.
- **The ledger.** `GET`/`POST /v1/movements`, with the degradation rule the rest
  of the product follows: a **read** falls back to a bundled fixture and says it
  did; a **write** never degrades. A movement the database did not take is shown
  as unsent and queued for retry, never rendered as though it had been stored.
- **Coverage that produces honest abstention.** The reference companies carry
  four of seven profile variables, so the engine answers `abstention` until the
  person simulating declares the rest. That is not a gap we tolerate — it is the
  rule working on real data.

Bulk loading was `\copy`: 675,667 rows from a normalisation script into the
hypertable, and the identifiers are derived from a hash of each observation's
key, so re-running the loader produces byte-identical files and a reload never
orphans a row.

The service itself was created and the schema applied from Tiger's CLI
(`tiger service create`, `tiger db connect`), which also ships an MCP server —
`tiger mcp install claude-code` wires the platform into an assistant session,
and it is installed here.

### What we have not used yet, and would next

We use TimescaleDB for partitioning. We do **not** yet use compression,
retention policies or continuous aggregates — with one cut-off date per company
there is nothing to compress or roll up honestly. The moment this holds several
years of movements per company, all three become obvious: compression on chunks
past the cut-off, a retention policy driven by the audit period, and continuous
aggregates over the weekly cash position that the survival indicator currently
recomputes on every run.

---

## Challenges we ran into

**Turning financial ratios into a cash calendar, honestly.** We loaded the UCI
Polish bankruptcy dataset — 43,169 companies, 2,073 real bankruptcy outcomes — to
get real outcome labels. It has 64 ratios and *no dates, no movements, no
counterparties*. Two derivations failed review before one survived: charging the
payables balance, the inventory balance and operating expenses as three separate
streams counted the same money three times and put **every** company in crisis;
deriving cost of sales from `Attr52` produced 352× sales at the median. The
version we kept is anchored on total costs / total sales, and every derived row
is stamped `hypothetical` so nobody can mistake it for something a business
reported.

**The model is fragile under missing data, and we had to say so.** CatBoost's
Average Precision on the Polish benchmark falls from 0.838 to 0.491 when 10% of
cells are hidden at random. That result is in the report, not hidden. It's also
why the engine **abstains** above 20% unknown variables rather than answering
confidently — and why a reference company with 4/7 coverage returns `abstention`
unless the caller explicitly declares the rest.

**Writing a spec is not the same as the spec being right.** Our PRD quoted an
explanation sentence with "el cobro llega el día 80" — that figure came from a
+20-day run, and the state in question is at +16 days, where collection arrives
on day 76. Because the rule was *the sentence is always composed from response
fields, never hard-coded*, the engine produced 76 and caught the document.
Likewise the 25% advance mark is the minimum at **zero** delay; at 16 days the
engine finds 27%. We corrected the docs, not the engine.

**Cold start, WebGL context loss in the 3D tower, and a demo that cannot depend
on the venue Wi-Fi.** The last one we solved by shipping four real precomputed
states: the interface renders instantly, and on a timeout or 5xx it degrades to
the nearest one and labels it *Escenario aproximado*. The fallback never invents
a number.

---

## Accomplishments that we're proud of

**Every number on screen has an engine run behind it.** No hand-written figure in
a fixture, no component that derives a state, no rounding that changes a value.
The front-end selects, formats and presents — that's it. A CI gate enforces it.

**We wrote down what we cannot claim, and then enforced it as code.** Our PRD has
a table of forbidden claims: no "predicts bankruptcies in Mexico", no "90%
precision" (our alert policy is 86.6–91.8% precise *while missing 29–45% of
events*), no calibrated probabilities (sigmoid calibration made Brier worse in
Poland — we published that too), no topological claims. A lexicon gate greps the
production build for the words we haven't earned.

**A negative result we kept.** On a 25/25 sample of Polish companies that did and
did not go bankrupt, our derived calendar produces the same state distribution
for both. It does not discriminate bankruptcy, and the docs say so in bold. It
would have been easy to quietly drop the experiment.

**The determinism insight.** Recognising that a seeded engine makes the response
a pure function of its query string turned a CDN into the engine's cache, killed
the cold-start problem for everyone but the first visitor, and let a hackathon
team run a real backend for pocket change.

---

## What we learned

- **Determinism is an architecture feature, not just a testing convenience.**
  It's what made caching correct, the demo robust, and the fixtures into golden
  tests all at once.
- **The intuitive reinforcement is often the wrong one.** Staggering a purchase
  and hiring gradually both looked prudent and both increased gap frequency to
  ~61%. This is the single most convincing thing the product does.
- **Naming the obligation beats naming the risk.** "Tu nómina del 26 de
  noviembre" produces action; "riesgo elevado" produces nothing.
- **Declaring your limits reads as rigour, not weakness.** Building the
  limitations strip into the interface — and the abstention state that dims the
  whole analysis when coverage is insufficient — made the product more credible,
  not less.
- **Put the language boundary in the contract.** `collection_delay_days` in JSON,
  "Retraso en cobranza" on screen. Never mixed inside a layer, and never a
  translation decision inside a component.

---

## What's next for Stackly

1. **Temporal and prospective validation with Mexican SMEs** — the one thing
   standing between a prototype and a claim. It needs company IDs, cut-off dates,
   availability dates and event dates, evaluated on future cut-offs only. Our
   data model already stores them.
2. **Real data in, through CFDI import and banking connectors**, with per-source
   freshness stamps and explicit reconciliation. We deliberately did not fake
   these in the demo.
3. **Tracking whether the recommendations actually work** — action offered,
   accepted, cost, emergency credit drawn, renegotiations. Without this,
   "prevents bankruptcies" stays a forbidden claim.
4. **The full structural twin**: the six stacks with 20–30 navigable nodes, the
   learned Bayesian propagation network, anomaly and regime-change detection, and
   the topological features as a properly evaluated experiment — kept or
   discarded on whether they beat a conventional cash-flow model, not on whether
   they make the pitch interesting.
5. **Alerts with episode keys** (company + obligation + episode), so a business
   gets notified on new severity or an imminent due date instead of the same
   warning every morning.
