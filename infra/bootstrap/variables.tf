variable "state_bucket_name" {
  type        = string
  description = <<-EOT
    Globally unique name for the Terraform state bucket, of the shape
    `fragility-tfstate-<suffix>` (docs/architecture.md §8). There is no default
    on purpose: the name has to be chosen once and then written by hand into
    infra/envs/prod/backend.tf, because a backend block cannot read a variable.
  EOT

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "An S3 bucket name is 3-63 characters of lowercase letters, digits, dots and hyphens."
  }
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Lowest pricing, and CloudFront requires the ACM certificate there."
}

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
