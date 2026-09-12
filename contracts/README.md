# contracts

JSON Schemas shared by the front-end, the Go domain, and the Python engine.
This directory is the single source of truth for every cross-service payload.

| File | Purpose |
| --- | --- |
| `actions.schema.json` | The five decisions and their editable parameters. Drives form generation in the front-end and validation in Go. |
| `state.schema.json` | The state document: survival, simulation, tension, propagation path, minimum reinforcement, warnings. Returned by the API and used for the offline fallback states. |

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
