output "web_acl_arn" {
  # CloudFront wants the ARN for WAFv2, despite the argument being named
  # `web_acl_id` — that name predates WAFv2 and still takes an id for Classic.
  # Null when disabled, which is what the site module's default expects.
  value       = one(aws_wafv2_web_acl.site[*].arn)
  description = "Attached to the distribution by the site module."
}
