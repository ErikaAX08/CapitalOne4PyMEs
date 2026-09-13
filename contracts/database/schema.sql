-- Structural fragility engine — relational schema (PostgreSQL 15+ with TimescaleDB).
-- Companion to docs/data-model.md. Deployed on Tiger Cloud, which is PostgreSQL with the
-- TimescaleDB extension; everything else stays on AWS (architecture.md §3).
--
-- Conventions: ULIDs as CHAR(26); money as BIGINT cents; an unknown value is NULL, never 0.
--
-- `movements` is a hypertable partitioned by `due_date`. TimescaleDB enforces uniqueness per
-- chunk, so "Any UNIQUE or PRIMARY KEY index must include the partition column"; that is why
-- the primary key and the dedup index below carry `due_date`, and why the tables that point at
-- a movement carry `movement_due_date` to form a composite foreign key. The consequence is
-- recorded in docs/data-model.md §1: the database no longer rejects a conflicting re-import on
-- its own, so internal/movements/application enforces it before the insert.

BEGIN;

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TYPE direction_t   AS ENUM ('in', 'out');
CREATE TYPE shift_t       AS ENUM ('none', 'delivery', 'collection');
CREATE TYPE scale_t       AS ENUM ('none', 'sales', 'cost');
CREATE TYPE exposure_t    AS ENUM ('none', 'main_customer');
CREATE TYPE provenance_t  AS ENUM ('known', 'declared', 'learned', 'hypothetical');
CREATE TYPE movement_status_t AS ENUM ('expected', 'confirmed', 'delayed', 'settled', 'cancelled');
CREATE TYPE movement_source_t AS ENUM ('bank', 'cfdi', 'manual', 'rule', 'action');
CREATE TYPE counterparty_kind_t AS ENUM ('customer', 'supplier', 'employee', 'lender', 'tax_authority');
CREATE TYPE stack_t AS ENUM ('finance', 'sales', 'operations', 'people', 'technology', 'compliance');
CREATE TYPE action_kind_t AS ENUM ('none', 'accept_project', 'extend_credit', 'hire_staff', 'buy_asset', 'request_financing');
CREATE TYPE run_status_t AS ENUM ('ok', 'abstention', 'error');
CREATE TYPE state_t AS ENUM ('stable', 'tension', 'crisis', 'abstention');
CREATE TYPE reinforcement_kind_t AS ENUM ('advance', 'capital_injection');
CREATE TYPE range_source_t AS ENUM ('documented', 'control_range', 'declared_assumption');
CREATE TYPE severity_t AS ENUM ('warning', 'critical');
CREATE TYPE outcome_kind_t AS ENUM ('payroll_uncovered', 'negative_balance', 'emergency_credit', 'tax_delay', 'supplier_delay');

-- Reference: the universal SME graph reduced to its nodes. Seeded from engine/graph.py.
CREATE TABLE graph_nodes (
    node_id          TEXT PRIMARY KEY,
    stack            stack_t NOT NULL,
    default_priority SMALLINT NOT NULL DEFAULT 99   -- intraday order among commitments
);

CREATE TABLE companies (
    company_id              CHAR(26) PRIMARY KEY,
    name                    TEXT NOT NULL,
    vertical                TEXT NOT NULL DEFAULT 'b2b_services',
    currency                CHAR(3) NOT NULL DEFAULT 'MXN' CHECK (currency = 'MXN'),
    payroll_interval_days   SMALLINT NOT NULL DEFAULT 15 CHECK (payroll_interval_days > 0),
    project_delivery_day    INTEGER  NOT NULL DEFAULT 30 CHECK (project_delivery_day >= 0),
    hire_monthly_cost_cents BIGINT   NOT NULL DEFAULT 4500000 CHECK (hire_monthly_cost_cents >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The company as observed at one cut-off date. NULL means unknown and counts against coverage.
CREATE TABLE company_snapshots (
    snapshot_id                 CHAR(26) PRIMARY KEY,
    company_id                  CHAR(26) NOT NULL REFERENCES companies,
    cutoff_date                 DATE NOT NULL,
    opening_balance_cents       BIGINT CHECK (opening_balance_cents >= 0),
    payroll_cents               BIGINT CHECK (payroll_cents >= 0),
    main_customer_concentration NUMERIC(5,4) CHECK (main_customer_concentration BETWEEN 0 AND 1),
    contracted_term_days        INTEGER CHECK (contracted_term_days >= 0),
    average_collection_days     INTEGER CHECK (average_collection_days >= 0),
    source_synced_at            TIMESTAMPTZ,                       -- freshness stamp per report §5
    known_variables             SMALLINT NOT NULL,
    total_variables             SMALLINT NOT NULL CHECK (total_variables > 0),
    UNIQUE (company_id, cutoff_date)
);

CREATE TABLE counterparties (
    counterparty_id  CHAR(26) PRIMARY KEY,
    company_id       CHAR(26) NOT NULL REFERENCES companies,
    kind             counterparty_kind_t NOT NULL,
    name             TEXT NOT NULL,
    revenue_share    NUMERIC(5,4) CHECK (revenue_share BETWEEN 0 AND 1),
    is_main_customer BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX counterparties_one_main_customer
    ON counterparties (company_id) WHERE is_main_customer;

-- Base calendar: a movement repeated every interval_days from first_due_date.
CREATE TABLE recurring_rules (
    rule_id         CHAR(26) PRIMARY KEY,
    company_id      CHAR(26) NOT NULL REFERENCES companies,
    node            TEXT NOT NULL REFERENCES graph_nodes,
    counterparty_id CHAR(26) REFERENCES counterparties,
    direction       direction_t NOT NULL,
    amount_cents    BIGINT NOT NULL CHECK (amount_cents >= 0),
    first_due_date  DATE NOT NULL,
    interval_days   SMALLINT NOT NULL CHECK (interval_days > 0),
    shift           shift_t NOT NULL DEFAULT 'none',
    scale           scale_t NOT NULL DEFAULT 'none',
    exposure        exposure_t NOT NULL DEFAULT 'none',
    provenance      provenance_t NOT NULL DEFAULT 'known',
    valid_from      DATE NOT NULL,
    valid_to        DATE,
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- The SME's dated cash movements. One row = one receipt or obligation.
CREATE TABLE movements (
    movement_id     CHAR(26) NOT NULL,
    company_id      CHAR(26) NOT NULL REFERENCES companies,
    node            TEXT NOT NULL REFERENCES graph_nodes,
    counterparty_id CHAR(26) REFERENCES counterparties,
    rule_id         CHAR(26) REFERENCES recurring_rules,
    direction       direction_t NOT NULL,
    due_date        DATE NOT NULL,
    amount_cents    BIGINT NOT NULL CHECK (amount_cents >= 0),
    settled_cents   BIGINT NOT NULL DEFAULT 0,
    settled_at      DATE,
    status          movement_status_t NOT NULL DEFAULT 'expected',
    known_at        DATE NOT NULL,                 -- when the fact became knowable
    available_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when it reached the system
    source          movement_source_t NOT NULL,
    source_ref      TEXT,
    shift           shift_t NOT NULL DEFAULT 'none',
    scale           scale_t NOT NULL DEFAULT 'none',
    exposure        exposure_t NOT NULL DEFAULT 'none',
    priority        SMALLINT,
    provenance      provenance_t NOT NULL DEFAULT 'known',
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT movements_reconciliation CHECK (settled_cents BETWEEN 0 AND amount_cents),
    CONSTRAINT movements_settled_consistent CHECK (
        (status = 'settled') = (settled_cents = amount_cents AND amount_cents > 0)
        OR status = 'cancelled'),
    -- `due_date` rides along because it is the partition column, not because a movement is
    -- identified by its date: `movement_id` alone is still unique in practice, and the
    -- application treats it as the identity.
    PRIMARY KEY (movement_id, due_date)
)
WITH (tsdb.hypertable = true, tsdb.partition_column = 'due_date');
-- Exact duplicates from the same source are one row. `due_date` is in the key only to satisfy
-- the hypertable requirement, which means the index alone no longer rejects the same
-- source_ref re-imported under a different date: internal/movements/application does that.
CREATE UNIQUE INDEX movements_dedup ON movements (company_id, source, source_ref, due_date) WHERE source_ref IS NOT NULL;
CREATE INDEX movements_calendar ON movements (company_id, due_date) WHERE status NOT IN ('settled', 'cancelled');
CREATE INDEX movements_known_at ON movements (company_id, known_at);

-- A committed parameterization. Insert-only; parameter_hash is the CloudFront cache key made durable.
CREATE TABLE scenarios (
    scenario_id             CHAR(26) PRIMARY KEY,
    company_id              CHAR(26) NOT NULL REFERENCES companies,
    snapshot_id             CHAR(26) NOT NULL REFERENCES company_snapshots,
    action_kind             action_kind_t NOT NULL,
    action_parameters       JSONB NOT NULL DEFAULT '{}',
    collection_delay_days   INTEGER NOT NULL DEFAULT 0 CHECK (collection_delay_days >= 0),
    main_customer_lost      BOOLEAN NOT NULL DEFAULT false,
    capital_injection_cents BIGINT  NOT NULL DEFAULT 0 CHECK (capital_injection_cents >= 0),
    seed                    INTEGER NOT NULL CHECK (seed >= 0),
    paths                   INTEGER NOT NULL CHECK (paths BETWEEN 100 AND 20000),
    horizon_days            INTEGER NOT NULL CHECK (horizon_days BETWEEN 30 AND 365),
    parameter_hash          CHAR(64) NOT NULL UNIQUE,       -- sha256 of the canonical query string
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analysis_runs (
    run_id                   CHAR(26) PRIMARY KEY,
    scenario_id              CHAR(26) NOT NULL REFERENCES scenarios,
    engine_version           TEXT NOT NULL,
    schema_version           TEXT NOT NULL,
    status                   run_status_t NOT NULL,
    state_id                 state_t,
    survival_weeks           INTEGER,
    upper_bounded            BOOLEAN,
    first_obligation_kind    TEXT REFERENCES graph_nodes,
    first_obligation_date    DATE,
    first_gap_cents          BIGINT CHECK (first_gap_cents >= 0),
    net_recurring_flow_cents BIGINT,
    event                    TEXT NOT NULL DEFAULT 'uncovered_obligation',
    horizon_days             INTEGER NOT NULL,
    gap_frequency            NUMERIC(7,6) CHECK (gap_frequency BETWEEN 0 AND 1),
    ci95_low                 NUMERIC(7,6),
    ci95_high                NUMERIC(7,6),
    mean_gap_cents           BIGINT,
    p95_gap_cents            BIGINT,
    state_document           JSONB NOT NULL,                -- the full contracts/state.schema.json payload
    correlation_id           TEXT,
    duration_ms              INTEGER,
    computed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX analysis_runs_scenario ON analysis_runs (scenario_id, computed_at DESC);

CREATE TABLE tension_factors (
    run_id       CHAR(26) NOT NULL REFERENCES analysis_runs ON DELETE CASCADE,
    factor       TEXT NOT NULL,
    stack        stack_t NOT NULL,
    margin       NUMERIC(18,4) NOT NULL,
    range        NUMERIC(18,4) NOT NULL CHECK (range > 0),
    unit         TEXT NOT NULL CHECK (unit IN ('cents', 'days', 'pp', 'ratio')),
    tension      NUMERIC(4,3) NOT NULL CHECK (tension BETWEEN 0 AND 1),
    range_source range_source_t NOT NULL,
    PRIMARY KEY (run_id, factor)
);

-- The minimum reinforcement offered, and what happened to it (report §5, effect of recommendations).
CREATE TABLE recommendations (
    recommendation_id    CHAR(26) PRIMARY KEY,
    run_id               CHAR(26) NOT NULL UNIQUE REFERENCES analysis_runs,
    kind                 reinforcement_kind_t NOT NULL,
    percentage           NUMERIC(6,2),
    amount_cents         BIGINT CHECK (amount_cents >= 0),
    required             BOOLEAN NOT NULL,
    gap_frequency_after  NUMERIC(7,6),
    weeks_after          INTEGER,
    state_after          state_t,
    offered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted             BOOLEAN,                    -- NULL = unknown
    accepted_at          TIMESTAMPTZ,
    realized_cost_cents  BIGINT,
    notes                TEXT
);

-- Alert episodes keyed by company + obligation (report §5, repeated alerts). Out of MVP scope.
CREATE TABLE alert_episodes (
    episode_id          CHAR(26) PRIMARY KEY,
    company_id          CHAR(26) NOT NULL REFERENCES companies,
    movement_id         CHAR(26) NOT NULL,
    movement_due_date   DATE NOT NULL,
    opened_on           DATE NOT NULL,
    resolved_on         DATE,
    severity            severity_t NOT NULL,
    streak              SMALLINT NOT NULL DEFAULT 1,
    last_sent_gap_cents BIGINT,
    last_sent_severity  severity_t,
    quality_ok          BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (movement_id, movement_due_date) REFERENCES movements (movement_id, due_date)
);
CREATE UNIQUE INDEX alert_episodes_open ON alert_episodes (company_id, movement_id) WHERE resolved_on IS NULL;

-- Observed events: the labels temporal validation needs (report §5). Never inferred by the engine.
CREATE TABLE outcome_events (
    event_id     CHAR(26) PRIMARY KEY,
    company_id   CHAR(26) NOT NULL REFERENCES companies,
    movement_id       CHAR(26),
    movement_due_date DATE,
    kind         outcome_kind_t NOT NULL,
    occurred_on  DATE NOT NULL,
    amount_cents BIGINT CHECK (amount_cents >= 0),
    evidence     TEXT,
    CHECK ((movement_id IS NULL) = (movement_due_date IS NULL)),
    FOREIGN KEY (movement_id, movement_due_date) REFERENCES movements (movement_id, due_date)
);
CREATE INDEX outcome_events_company ON outcome_events (company_id, occurred_on);

INSERT INTO graph_nodes (node_id, stack, default_priority) VALUES
    ('cash', 'finance', 99), ('reserve', 'finance', 99), ('debt', 'finance', 50), ('credit', 'finance', 99),
    ('sales', 'sales', 99), ('customer', 'sales', 99), ('invoice', 'sales', 99), ('collection', 'sales', 99),
    ('delivery', 'operations', 99), ('materials', 'operations', 10), ('capacity', 'operations', 99), ('supplier', 'operations', 30),
    ('payroll', 'people', 40), ('staff', 'people', 99), ('hiring', 'people', 20), ('critical_person', 'people', 99),
    ('billing_system', 'technology', 99), ('infrastructure', 'technology', 99), ('backups', 'technology', 99), ('tech_provider', 'technology', 99),
    ('tax', 'compliance', 60), ('license', 'compliance', 99), ('insurance', 'compliance', 99), ('regulation', 'compliance', 99);

COMMIT;
