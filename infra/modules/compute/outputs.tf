output "engine_function_name" {
  value       = aws_lambda_function.engine.function_name
  description = "The Python engine."
}

output "engine_function_arn" {
  value       = aws_lambda_function.engine.arn
  description = "Scopes the deploy role's update permission."
}

output "engine_invoke_arn" {
  value       = aws_lambda_function.engine.invoke_arn
  description = "What an API Gateway AWS_PROXY integration needs."
}

output "domain_function_name" {
  value       = one(aws_lambda_function.domain[*].function_name)
  description = "The Go domain, or null while it is not deployed."
}

output "domain_function_arn" {
  value       = one(aws_lambda_function.domain[*].arn)
  description = "Scopes the deploy role's update permission, and the guardrails alarms."
}

output "domain_invoke_arn" {
  value       = one(aws_lambda_function.domain[*].invoke_arn)
  description = "Null keeps the api module routing everything to the engine."
}

output "database_parameter_name" {
  value       = aws_ssm_parameter.database_connection_string.name
  description = "Where to put the Tiger Cloud connection string with `aws ssm put-parameter`."
}

output "database_parameter_arn" {
  value       = aws_ssm_parameter.database_connection_string.arn
  description = "Scopes the Go role's read permission."
}
