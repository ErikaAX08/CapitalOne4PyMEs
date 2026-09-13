# contracts

JSON Schemas shared by the front-end, the Go domain, and the Python engine.
This directory is the single source of truth for every cross-service payload.

| File | Purpose |
| --- | --- |
| `actions.schema.json` | The five decisions and their editable parameters. Drives form generation in the front-end and validation in Go. |
| `state.schema.json` | The state document: survival, simulation, tension, propagation path, minimum reinforcement, warnings, notices, definitions. Returned by the API and used for the offline fallback states. Field-by-field mapping to the PRD cards in `docs/module-contract.md`. |
| `engine-request.schema.json` | Payload the Go domain sends to the Python engine on `lambda:Invoke`: company profile, action, stress controls, run parameters. |
| `database/migrations/` | Deltas for databases created before a change to `schema.sql`. `schema.sql` stays the source of truth; these exist so an already-deployed database can catch up. |
| `database/schema.sql` | Relational schema (PostgreSQL with TimescaleDB). `movements` and `graph_nodes` are deployed on Tiger Cloud and used by `/v1/movements`; the rest is created but not yet written to. Documented in `docs/data-model.md`. |

## Rules

- **English field names.** User-facing labels are Spanish and live in the front-end,
  never in the schema.
- **Money as an integer count of cents**, with the `_cents` suffix.
- **Versioned.** Every payload carries `schema`. An unknown version is a visible
  failure, never a silent zero.
- **Change here first**, then in the services. CI validates both sides against
  these files, so a mismatch fails the build rather than the demo.
- A parameter schema also declares its limits, its default, and any slider marks,
  so documented thresholds are data rather than hard-coded constants.
