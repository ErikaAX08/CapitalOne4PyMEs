variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

variable "notification_emails" {
  type        = list(string)
  description = <<-EOT
    Who hears about a budget threshold or a firing alarm. An SNS email
    subscription has to be confirmed from the inbox before it delivers
    anything, so check for the confirmation mail after the first apply.
  EOT

  validation {
    condition     = length(var.notification_emails) > 0
    error_message = "A budget nobody is told about is not a guardrail. Give at least one address."
  }
}

variable "monthly_budget_usd" {
  type        = number
  default     = 100
  description = "The size of the credit. The thresholds below are absolute dollars against it."
}

variable "budget_alert_thresholds_usd" {
  type        = list(number)
  default     = [20, 50, 80]
  description = "docs/architecture.md §8. Absolute dollars, not percentages, because the credit is what is being spent."
}

# --- Alarms -------------------------------------------------------------------

variable "engine_function_name" {
  type        = string
  description = "The Python engine, for the duration alarm."
}

variable "domain_function_name" {
  type        = string
  default     = null
  description = "The Go domain, for the error-rate alarm. Null while it is not deployed, and the alarm is then not created."
}

variable "engine_p99_duration_threshold_ms" {
  type        = number
  default     = 3000
  description = <<-EOT
    Three seconds is the number the front-end already treats as the limit: past
    it the interface falls back to the nearest precomputed state and labels it
    approximate (docs/architecture.md §4.2). An alarm on the same number says
    the degradation path is being exercised.
  EOT
}

variable "distribution_id" {
  type        = string
  description = "The CloudFront distribution, for the cache-hit-rate alarm."
}

variable "enable_cache_hit_rate_alarm" {
  type        = bool
  default     = false
  description = <<-EOT
    Off by default, and the reason is cost. CacheHitRate is not a free
    CloudFront metric: it needs additional metrics enabled on the distribution,
    which is billed per metric per month and comes to more than the whole
    ~1.30 USD/month the architecture budgets for. Turn it on for the event if
    the number is wanted live, then turn it back off.
  EOT
}
