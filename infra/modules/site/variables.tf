variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

variable "bucket_name" {
  type        = string
  description = "Globally unique name for the private site bucket."
}

# --- The API origin -----------------------------------------------------------
#
# docs/architecture.md §8 lists the `/v1/*` behaviour under the `api` module and
# the distribution under `site`. A CloudFront distribution is a single resource,
# so its behaviours cannot be declared from another module; the split is kept by
# having `api` own the API Gateway and the cache policy and pass them in here.

variable "api_origin_domain_name" {
  type        = string
  description = "Host of the API Gateway HTTP API, without scheme or path."
}

variable "analysis_cache_policy_id" {
  type        = string
  description = "The deterministic-analysis cache policy, created by the api module."
}

variable "analysis_function_arn" {
  type        = string
  description = "Viewer-request function that strips query parameters the engine ignores, so they cannot multiply the cache key. Created by the api module, which owns the contract it is generated from."
}

# --- Optional custom domain ---------------------------------------------------
#
# Off by default: the front-end calls /v1/* as same-origin relative paths, so
# CloudFront's own dxxxx.cloudfront.net domain and certificate are enough. Both
# variables have to be set together — a certificate cannot be validated without
# a zone to write the validation record into.

variable "domain_name" {
  type        = string
  default     = ""
  description = "Custom domain for the site. Empty means use the CloudFront default domain."
}

variable "route53_zone_id" {
  type        = string
  default     = ""
  description = "Hosted zone that owns domain_name, used to validate the certificate and alias the distribution."
}

variable "price_class" {
  type        = string
  default     = "PriceClass_100"
  description = "PriceClass_100 covers North America and Europe, which is where the demo is watched from."
}
