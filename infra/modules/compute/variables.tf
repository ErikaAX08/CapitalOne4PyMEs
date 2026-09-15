variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

# --- The Python engine --------------------------------------------------------

variable "engine_package_path" {
  type        = string
  description = <<-EOT
    Path to the zip built by services/engine/scripts/package_lambda.sh. It must
    exist before plan: Terraform hashes the file to decide whether the function
    changed, and a missing file is an error rather than a no-op.
  EOT
}

variable "engine_memory_mb" {
  type        = number
  default     = 2048
  description = "docs/architecture.md §12. On arm64 more memory also means proportionally more CPU, which is what keeps a 5,000-path Monte Carlo inside a second."
}

variable "engine_timeout_seconds" {
  type        = number
  default     = 30
  description = "Above the API Gateway integration timeout, so the integration is what gives up first and returns a shaped error."
}

variable "engine_cutoff_date" {
  type        = string
  default     = "2026-09-12"
  description = "ENGINE_CUTOFF_DATE. Matches defaultCutoff in services/domain/cmd/analysis/main.go so both paths date a run identically."
}

variable "engine_cache_control" {
  type        = string
  default     = "public, max-age=3600"
  description = "ENGINE_CACHE_CONTROL. Matches the cache policy's default_ttl."
}

variable "engine_reserved_concurrency" {
  type        = number
  default     = 10
  description = <<-EOT
    Hard cap on how many engine invocations can run at once, and therefore on
    how fast the account can spend. Enforced by Lambda, unlike the budget in
    `guardrails`, which only notifies and does so with hours of lag.

    Set to -1 to remove the cap entirely. Do not: the function is reachable
    from the public internet through CloudFront, and at 2 GB a sustained
    request flood is the one failure mode that drains the credit in hours.
  EOT
}

variable "engine_provisioned_concurrency" {
  type        = number
  default     = 0
  description = <<-EOT
    Measure 5 of docs/architecture.md §10, and the only one that costs money:
    about 0.50 USD per day per unit, against roughly 12 USD/month if it is left
    on. Zero except on the day of the event.
  EOT
}

# --- The Go domain ------------------------------------------------------------

variable "enable_domain_lambda" {
  type        = bool
  default     = false
  description = <<-EOT
    False until services/domain has a Lambda entry point. Today
    cmd/analysis/main.go is an HTTP server and go.mod requires no Lambda
    runtime, so there is no artifact to deploy; its own doc comment says the
    Lambda mode "is not written yet".

    Everything the Go tier needs is declared here and stays inert at count 0:
    the function, its role, its log group, the least-privilege permission to
    invoke exactly one Python function, and its warming target. Flipping this to
    true is the whole change.
  EOT
}

variable "domain_package_path" {
  type        = string
  default     = null
  description = "Path to the Go zip. Only read when enable_domain_lambda is true."
}

variable "domain_memory_mb" {
  type        = number
  default     = 512
  description = "docs/architecture.md §12. The Go tier validates, translates and projects; it does not compute."
}

variable "domain_timeout_seconds" {
  type        = number
  default     = 30
  description = "Room to return the engine's timeout as a shaped error rather than be cut off mid-answer."
}

variable "domain_company_id" {
  type        = string
  default     = ""
  description = <<-EOT
    DOMAIN_COMPANY_ID — which company a request with no company_id gets. Empty
    leaves it unset, which means the demo company from the fixture. A value that
    the database does not hold makes the function fail at start-up rather than
    turn every unqualified call into a 404, which is the behaviour main.go
    deliberately chose.
  EOT
}

# --- The ledger's connection string -------------------------------------------

variable "database_parameter_name" {
  type        = string
  default     = "/fragility/prod/database_connection_string"
  description = "SSM Parameter Store path holding the Tiger Cloud connection string."
}

variable "database_connection_string" {
  type        = string
  default     = ""
  sensitive   = true
  description = <<-EOT
    Optional. When set, the value is passed to the Go function as
    DATABASE_CONNECTION_STRING, which is the variable services/domain actually
    reads (cmd/analysis/main.go).

    Leave it empty in normal use. The value then lives only in SSM, put there
    outside Terraform, and never enters the state file. The cost of leaving it
    empty today is that the function starts without persistence — which is a
    handled state, not a failure: every other route works and /v1/movements
    answers 503 rather than pretending to store anything.

    See infra/README.md for what still has to happen for the function to read
    SSM by itself.
  EOT
}

# --- Shared -------------------------------------------------------------------

variable "log_retention_days" {
  type        = number
  default     = 7
  description = "Declared here rather than created implicitly by Lambda, which is what stops them defaulting to infinite retention."
}

variable "warming_rate_minutes" {
  type        = number
  default     = 5
  description = "Measure 4 of docs/architecture.md §10. Negligible cost, and it keeps both functions warm through the event."
}

variable "enable_warming" {
  type        = bool
  default     = true
  description = "Off outside an event window if the invocations are not wanted."
}
