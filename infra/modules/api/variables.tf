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

variable "log_retention_days" {
  type        = number
  default     = 7
  description = "Log groups are declared here rather than created implicitly, which is what stops them defaulting to infinite retention."
}

variable "throttling_rate_limit" {
  type        = number
  default     = 50
  description = "Steady-state requests per second. A bound on the bill, not on the demo: a jury generates single-digit RPS."
}

variable "throttling_burst_limit" {
  type        = number
  default     = 100
  description = "Burst capacity above the steady-state rate."
}
