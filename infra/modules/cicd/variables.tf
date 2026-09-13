variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

variable "github_repository" {
  type        = string
  description = <<-EOT
    owner/repo allowed to assume the deploy role. Taken from the module path in
    services/domain/go.mod.
  EOT

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Expected owner/repo."
  }
}

variable "allowed_branches" {
  type        = list(string)
  default     = ["main"]
  description = <<-EOT
    Branches whose workflow runs may assume the role. `deploy.yml` only runs on
    a push to main, and narrowing the trust policy to it means a pull request
    from a fork cannot reach this account even if it manages to run a workflow.
  EOT
}

variable "create_oidc_provider" {
  type        = bool
  default     = true
  description = <<-EOT
    An account may hold only one OIDC provider per URL. Set false if
    token.actions.githubusercontent.com is already registered in this account —
    creating it twice is an EntityAlreadyExists error, not a merge.
  EOT
}

variable "state_bucket_name" {
  type        = string
  description = "The bootstrap bucket. The deploy role needs to read and write the state and its lockfile."
}

variable "site_bucket_arn" {
  type        = string
  description = "Scopes the site sync permission."
}

variable "distribution_arn" {
  type        = string
  description = "Scopes the invalidation permission."
}

variable "lambda_function_arns" {
  type        = list(string)
  description = "The functions the deploy may update. Nulls are filtered out, so the Go function can be absent."
}

variable "region" {
  type        = string
  description = "Region the ARNs in the deploy policy are built for."
}
