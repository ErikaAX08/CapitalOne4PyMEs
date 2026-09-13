# infra — Terraform

One environment, `prod`. Region `us-east-1`: lowest pricing, and CloudFront
requires ACM certificates there. Everything is `arm64`.

## Modules

| Module | Contents |
| --- | --- |
| `site` | Private S3 bucket, CloudFront distribution, Origin Access Control, ACM certificate |
| `api` | API Gateway HTTP API, the `/v1/*` CloudFront behaviour, cache policy |
| `compute` | Go and Python Lambdas, IAM roles, warming rule |
| `cicd` | GitHub OIDC provider and least-privilege deploy role |
| `guardrails` | AWS Budgets alerts, error and duration alarms |

`bootstrap/` creates the state bucket once, by hand. Everything else is managed
by CI.

## State

```hcl
terraform {
  required_version = ">= 1.10"
  backend "s3" {
    bucket       = "fragility-tfstate-<suffix>"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Native S3 locking — no DynamoDB table needed since Terraform 1.10.

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
  implicitly by Lambda, they default to infinite retention.
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
