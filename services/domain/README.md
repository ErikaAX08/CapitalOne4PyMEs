# services/domain — Go

Owns the business invariants and the anti-corruption layer over the Python
engine. Deployed as a single Lambda behind API Gateway; a modular monolith, not
a set of microservices.

## Bounded contexts

| Context | Aggregates and value objects | Invariants it enforces |
| --- | --- | --- |
| `scenario` | `Scenario`, the five `Action` implementations, `Seed` | A committed scenario is immutable · the seed is fixed at creation · no action increases total revenue, it only reschedules it · no movement may predate the cut-off date |
| `risk` | `Assessment`, `Abstention`, `Coverage`, `BreakingPoint` | Above 20% unknown variables the result is an abstention, not a probability · every probability declares its event and horizon |

`shared/kernel` holds the types both contexts depend on: `Money` (int64 cents),
`CutoffDate`, `Horizon`, `Probability`, `Confidence`, `Provenance`.

## Layout

```
cmd/analysis/                 Lambda handler
internal/scenario/
  domain/                     entities, value objects, invariants
  application/                use cases and ports
  adapters/                   AWS, HTTP, engine client
internal/risk/
  domain/ application/ adapters/
internal/shared/kernel/
```

## The rule that makes this DDD rather than folders

`internal/*/domain/` imports nothing from `aws-sdk-go-v2` and nothing from an
`adapters` package. It is checked in CI:

```sh
! grep -rl "aws-sdk-go-v2\|/adapters" internal/*/domain/
```

If a domain type needs something from infrastructure, the dependency is
inverted — the port lives in `application/`, the implementation in `adapters/`.

## Adding an action

An `Action` is an immutable value object that produces cash movements. It knows
nothing about Monte Carlo, probabilities, or the interface.

```go
type Action interface {
    Kind() ActionKind
    Validate() error
    Apply(kernel.Calendar) kernel.Calendar
}
```

Three steps: add the parameter schema to `contracts/actions.schema.json`,
implement `Action`, register it in the factory. The front-end form is generated
from the schema, so no interface component changes.
