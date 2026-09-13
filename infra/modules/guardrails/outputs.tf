output "alarm_topic_arn" {
  value       = aws_sns_topic.alarms.arn
  description = "Every email subscription on it has to be confirmed from the inbox before it delivers."
}

output "budget_name" {
  value       = aws_budgets_budget.monthly.name
  description = "The monthly cost budget with its absolute-dollar thresholds."
}
