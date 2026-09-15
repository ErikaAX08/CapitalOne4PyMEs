variable "name_prefix" {
  type        = string
  description = "Prefix for every name this module creates."
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = <<-EOT
    Off turns the rate limiting off and stops the charge for it, which is about
    7 USD a month: 5 for the web ACL and 1 per rule, plus 0.60 per million
    requests that at demo volume rounds to nothing.

    Leave it on whenever the site URL is public. The other cost controls bound
    the bill by refusing service to everyone at once; this is the only one that
    bounds a single abusive client.
  EOT
}

variable "api_rate_limit" {
  type        = number
  default     = 300
  description = "Requests to /v1/* per IP per five minutes before blocking. 300 is one per second sustained, far above a person clicking through scenarios."
}

variable "site_rate_limit" {
  type        = number
  default     = 3000
  description = "Requests of any kind per IP per five minutes. Loose on purpose: a full page load is about thirty requests and an event shares one address."
}
