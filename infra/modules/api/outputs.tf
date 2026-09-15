output "api_id" {
  value       = aws_apigatewayv2_api.this.id
  description = "The HTTP API."
}

output "api_endpoint" {
  value       = aws_apigatewayv2_api.this.api_endpoint
  description = "Direct origin URL. Useful for a smoke test that deliberately bypasses the cache."
}

output "origin_domain_name" {
  value       = replace(aws_apigatewayv2_api.this.api_endpoint, "https://", "")
  description = "Host only, which is the shape a CloudFront origin needs."
}

output "analysis_cache_policy_id" {
  value       = aws_cloudfront_cache_policy.analysis.id
  description = "Attached to the /v1/analysis* behaviour by the site module."
}

output "analysis_function_arn" {
  value       = aws_cloudfront_function.normalize_analysis_query.arn
  description = "Attached to the /v1/analysis* behaviour by the site module, on viewer-request, so it runs before the cache lookup."
}

output "access_log_group_name" {
  value       = aws_cloudwatch_log_group.access.name
  description = "Where the structured access log lands, with seven-day retention."
}
