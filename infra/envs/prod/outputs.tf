output "site_url" {
  value       = module.site.site_url
  description = "What to open, and what the post-deploy warming requests hit."
}

output "site_bucket_name" {
  value       = module.site.bucket_name
  description = "Sync `apps/web/dist` here."
}

output "distribution_id" {
  value       = module.site.distribution_id
  description = "Invalidate this on every deploy. Without it the previous version keeps being served."
}

output "api_endpoint" {
  value       = module.api.api_endpoint
  description = "The origin, bypassing the cache. Useful for a smoke test that must not be answered from CloudFront."
}

output "deploy_role_arn" {
  value       = module.cicd.deploy_role_arn
  description = "`role-to-assume` in the workflow."
}

output "engine_function_name" {
  value       = module.compute.engine_function_name
  description = "The Python engine."
}

output "domain_function_name" {
  value       = module.compute.domain_function_name
  description = "The Go domain, or null while enable_domain_lambda is false."
}

output "database_parameter_name" {
  value       = module.compute.database_parameter_name
  description = "Where the Tiger Cloud connection string goes. Put it there with `aws ssm put-parameter --overwrite`."
}

output "alarm_topic_arn" {
  value       = module.guardrails.alarm_topic_arn
  description = "Confirm the email subscription from the inbox, or nothing is ever delivered."
}
