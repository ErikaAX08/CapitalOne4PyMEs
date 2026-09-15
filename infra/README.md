# infra — Terraform

One environment, `prod`. Region `us-east-1`: lowest pricing, and CloudFront
requires ACM certificates there. Everything is `arm64`.

## Modules

| Module | Contents |
| --- | --- |
| `site` | Private S3 bucket, CloudFront distribution, Origin Access Control, the `/v1/*` behaviours, optional ACM certificate |
| `api` | API Gateway HTTP API, routes, and the deterministic-analysis cache policy |
| `compute` | Go and Python Lambdas, IAM roles, log groups, warming rule, the ledger's SSM parameter |
| `cicd` | GitHub OIDC provider and least-privilege deploy role |
| `guardrails` | AWS Budgets alerts, error and duration alarms |

`bootstrap/` creates the state bucket once, by hand. Everything else is managed
by CI.

The `/v1/*` behaviours sit in `site` rather than `api`, which is where
`docs/architecture.md` §8 puts them: a CloudFront distribution is a single
resource, so its behaviours cannot be declared from a second module. `api` still
owns the API Gateway and the cache policy and passes them in.

Client-side routing is handled by a CloudFront Function on the site behaviour
(`modules/site/functions/spa-router.js`), not by `custom_error_response`. Custom
error responses apply to the whole distribution, so they would turn a genuine
`404` from `/v1/companies` into `index.html` with status `200` — the kind of
silent failure `AGENTS.md` forbids.

## State

```hcl
terraform {
  required_version = ">= 1.10"
  backend "s3" {
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Native S3 locking — no DynamoDB table needed since Terraform 1.10.

`bucket` is absent because a backend block cannot read a variable and the name
carries a globally unique suffix. It arrives as partial configuration instead:

```sh
cd infra/bootstrap
tofu init && tofu apply -var 'state_bucket_name=fragility-tfstate-<suffix>'

cd ../envs/prod
cp backend.hcl.example backend.hcl              # paste the bucket name
cp terraform.tfvars.example terraform.tfvars    # the two bucket names and an email
tofu init -backend-config=backend.hcl
tofu plan
```

`backend.hcl` and `*.tfvars` are gitignored. The Python zip has to exist before
`plan` — OpenTofu hashes it to decide whether the function changed, and a
missing file is an error, not a no-op:

```sh
cd services/engine && scripts/package_lambda.sh
```

## The Go tier is declared but switched off

`enable_domain_lambda` defaults to `false`, and it is not a placeholder: the
function, its role, its log group, its warming target and the least-privilege
permission to invoke exactly one Python function are all declared and simply sit
at `count = 0`.

There is nothing to deploy yet. `services/domain` builds an HTTP server —
`cmd/analysis/main.go` says so itself — and `go.mod` requires no Lambda runtime.

Meanwhile `GET /v1/analysis` is answered by the Python engine directly, which
`engine/handler.py` supports deliberately: it handles an API Gateway v2 event so
that "the API is usable before the Go domain is deployed". The routes that need
Go — `/v1/actions`, `/v1/companies`, `/v1/movements` — do not exist until the
flag is on.

Three things have to be true before flipping it:

1. An entry point that speaks the Lambda runtime API, and `aws-lambda-go` in
   `go.mod`.
2. A packaging script that writes a zip with the binary named `bootstrap` at the
   root, plus `contracts/` and `fixtures/`. `DOMAIN_CONTRACTS_DIR` and
   `DOMAIN_COMPANY_PROFILE` are set to `/var/task/...` because main.go's default
   walks *up* from the working directory looking for `contracts/`, and under
   Lambda there is nothing above `/var/task`.
3. Agreement on how the function learns which engine to invoke.
   `modules/compute/main.tf` passes `ENGINE_FUNCTION_NAME`, which is the one
   name in this directory that no code reads yet — a proposal, not an observed
   contract.

## Rules

- **No VPC.** A NAT Gateway is roughly 32 USD per month, a third of the budget
  spent on networking plumbing with nothing to isolate.
- **No database inside AWS.** The analysis is pure, so it persists nothing. The
  ledger does persist, but it lives on Tiger Cloud (PostgreSQL with
  TimescaleDB), reached over TLS from the Go function — so there is still no
  RDS, no Aurora, and no VPC to put them in. The connection string is
  configuration, not Terraform state: keep it in SSM Parameter Store.
- The site bucket is private, reachable only through Origin Access Control.
  Never public website hosting.
- **Log groups are declared in Terraform** with `retention_in_days = 7`. Created
  implicitly by Lambda, they default to infinite retention. The roles are not
  granted `logs:CreateLogGroup`, so a function cannot create an unretained one
  by accident.
- Least privilege: the Go function may invoke exactly one Python function.
- `default_tags` sets `Project`, `Owner`, `Env`, `CostCenter`. Without them Cost
  Explorer is unreadable.
- CloudFront invalidation runs on every deploy. Without it the previous version
  keeps being served — a silent failure, and an expensive one during a pitch.

## Why the cache policy matters

The engine is deterministic with a fixed seed, so a response is a pure function
of its query string. `query_string_behavior = "all"` is therefore correct, and
it turns the CDN into a memo table for the engine. With an unseeded stochastic
engine, caching would be a bug.

That policy is attached to `/v1/analysis*` only. Everything else under `/v1` —
the ledger and the company catalogue — goes to a behaviour with caching
disabled. The origin already declares those `no-store`, but a cache policy with
`min_ttl = 60` is honoured *over* a `no-store` response header, so relying on
the origin's headers alone would cache a write path for a minute.

## The Tiger Cloud connection string

Terraform declares the parameter and never learns its value:

```sh
aws ssm put-parameter --overwrite \
  --name "$(tofu output -raw database_parameter_name)" \
  --type SecureString \
  --value 'postgres://…@….tsdb.cloud.timescale.com:…/tsdb?sslmode=require'
```

`lifecycle { ignore_changes = [value] }` is what stops the next apply from
overwriting it with the placeholder, and it is the reason the secret never
appears in a plan, a state file or a log line.

The Tiger Cloud service itself is **not** managed here. It already exists, it
was created outside Terraform, and importing it would put the database password
into the state file and bring a bad `replace` within reach of the data. There is
an official `timescale/timescale` provider if that trade ever looks worth
making; it is not made today.

**Open gap.** `services/domain` reads the connection string from the environment
variable `DATABASE_CONNECTION_STRING` (`cmd/analysis/main.go`); it does not read
SSM. The parameter and the IAM permission are in place, but nothing yet carries
the value from one to the other. Until either the Go service learns to resolve
SSM at start-up or the deploy injects the value, the function starts without
persistence — a handled state rather than a failure: every other route works and
`/v1/movements` answers `503` instead of pretending to store anything.
`var.database_connection_string` is the deliberate escape hatch, and it puts the
secret in the state file, which is why it is empty by default.

## Costs that are off by default

| Switch | Why it is off |
| --- | --- |
| `engine_provisioned_concurrency` | ~0.50 USD/day per unit, ~12 USD/month if left on. Set to `1` the morning of the event, back to `0` after. |
| `enable_cache_hit_rate_alarm` | `CacheHitRate` is not a free CloudFront metric; additional metrics are billed per metric per month and come to more than the whole ~1.30 USD/month budget. |
| `domain_name` / `route53_zone_id` | The front-end calls `/v1/*` same-origin, so the CloudFront default domain is enough. Both are needed together: a certificate cannot be validated without a zone. |
