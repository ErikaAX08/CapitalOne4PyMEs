variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

variable "engine_lambda_invoke_arn" {
  type        = string
  description = "Invoke ARN of the Python engine function."
}

variable "engine_lambda_function_name" {
  type        = string
  description = "Name of the Python engine function, for the invoke permission."
}

# --- The Go domain tier -------------------------------------------------------
#
# Null until services/domain grows a Lambda entry point. While it is null the
# API routes GET /v1/analysis straight to the Python engine, which handles an
# API Gateway v2 event itself — engine/handler.py says so in as many words:
# the HTTP shape exists "so the API is usable before the Go domain is deployed".

variable "domain_lambda_invoke_arn" {
  type        = string
  default     = null
  description = "Invoke ARN of the Go domain function, or null while it does not exist."
}

variable "domain_lambda_function_name" {
  type        = string
  default     = null
  description = "Name of the Go domain function, for the invoke permission."
}

variable "actions_schema_path" {
  type        = string
  default     = null
  description = "contracts/actions.schema.json, the source the cache-key allowlist is generated from. Null resolves it relative to this module."
}

variable "log_retention_days" {
  type        = number
  default     = 7
  description = "Log groups are declared here rather than created implicitly, which is what stops them defaulting to infinite retention."
}

variable "throttling_rate_limit" {
  type        = number
  default     = 5
  description = <<-EOT
    Steady-state requests per second for the whole stage.

    This was 50, which bounded nothing that mattered: sustained at 50 RPS the
    2 GB engine spends the entire 100 USD credit in well under a day, and the
    budget alert would arrive after the fact. A jury generates single-digit
    RPS, and everything they touch is a CloudFront cache hit that never
    reaches this stage at all, so 5 is the demo's real ceiling with headroom.
  EOT
}

variable "throttling_burst_limit" {
  type        = number
  default     = 10
  description = "Burst capacity above the steady-state rate. Absorbs the handful of parallel requests a page load makes."
}
