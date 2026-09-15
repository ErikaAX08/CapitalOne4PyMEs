variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Lowest pricing, and the only region CloudFront takes a certificate from."
}

variable "name_prefix" {
  type        = string
  default     = "fragility"
  description = "Prefix for every name in this environment."
}

variable "site_bucket_name" {
  type        = string
  description = "Globally unique name for the private site bucket, e.g. fragility-site-<suffix>."
}

variable "state_bucket_name" {
  type        = string
  description = "The bootstrap bucket. Terraform reads it from backend.hcl; this repeats it so the deploy role can be scoped to it."
}

# --- Tags ---------------------------------------------------------------------

variable "project" {
  type        = string
  default     = "CapitalOne4PyMEs"
  description = "Value of the Project tag."
}

variable "owner" {
  type        = string
  default     = "stackly"
  description = "Value of the Owner tag."
}

variable "cost_center" {
  type        = string
  default     = "hackathon"
  description = "Value of the CostCenter tag."
}

# --- Packaging ----------------------------------------------------------------

variable "engine_package_path" {
  type        = string
  default     = null
  description = <<-EOT
    Built by `services/engine/scripts/package_lambda.sh`, which writes
    services/engine/build/engine.zip. Null uses that path. The file has to exist
    before plan: Terraform hashes it to decide whether the code changed.
  EOT
}

variable "domain_package_path" {
  type        = string
  default     = null
  description = "Only read when enable_domain_lambda is true. No packaging script exists for it yet."
}

# --- The Go tier --------------------------------------------------------------

variable "enable_domain_lambda" {
  type        = bool
  default     = false
  description = <<-EOT
    False until services/domain has a Lambda entry point — today
    cmd/analysis/main.go is an HTTP server and its own doc comment says the
    Lambda mode is not written yet.

    While it is false, GET /v1/analysis is served by the Python engine directly,
    which engine/handler.py supports on purpose. /v1/actions, /v1/companies and
    /v1/movements do not exist until it is true.
  EOT
}

variable "domain_company_id" {
  type        = string
  default     = ""
  description = "DOMAIN_COMPANY_ID. Empty means the demo company from the fixture."
}

variable "database_connection_string" {
  type        = string
  default     = ""
  sensitive   = true
  description = <<-EOT
    Leave empty. The Tiger Cloud connection string belongs in SSM Parameter
    Store, written out of band, so it never enters the state file — see
    infra/README.md. Setting it here passes it to the function as an
    environment variable and puts it in the state, which is a deliberate
    trade-off, not a default.
  EOT
}

# --- Cold start ---------------------------------------------------------------

variable "cutoff_date" {
  type        = string
  default     = "2026-09-12"
  description = "ENGINE_CUTOFF_DATE and DOMAIN_CUTOFF_DATE. One date for both paths."
}

variable "enable_warming" {
  type        = bool
  default     = true
  description = "The five-minute rule of docs/architecture.md §10, measure 4."
}

variable "engine_provisioned_concurrency" {
  type        = number
  default     = 0
  description = "Measure 5. Set to 1 on the morning of the event, back to 0 after. About 0.50 USD per day."
}

# --- Optional custom domain ---------------------------------------------------

variable "domain_name" {
  type        = string
  default     = ""
  description = "Empty uses the CloudFront default domain, which is all the front-end needs: it calls /v1/* same-origin."
}

variable "route53_zone_id" {
  type        = string
  default     = ""
  description = "Required alongside domain_name: a certificate cannot be validated without a zone to write the record into."
}

# --- CI/CD --------------------------------------------------------------------

variable "github_repository" {
  type        = string
  default     = "ErikaAX08/CapitalOne4PyMEs"
  description = "From the module path in services/domain/go.mod."
}

variable "allowed_branches" {
  type        = list(string)
  default     = ["main"]
  description = "deploy.yml only runs on a push to main, so main is the only branch that needs to reach this account."
}

# --- Guardrails ---------------------------------------------------------------

variable "notification_emails" {
  type        = list(string)
  description = "Budget thresholds and alarms go here. No default: a guardrail nobody hears is not one."
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = <<-EOT
    Per-IP rate limiting on the distribution, at about 7 USD a month.

    On by default because the site URL is public. The reserved concurrency and
    the stage throttle bound what the account can spend, but they do it per
    stage rather than per client, so without this one caller saturating the
    throttle takes the demo down for everyone.
  EOT
}

variable "enable_cache_hit_rate_alarm" {
  type        = bool
  default     = false
  description = "Costs more per month than the rest of the architecture put together. On for the event if wanted, off after."
}
