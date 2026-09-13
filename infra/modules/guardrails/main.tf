# guardrails — the budget that protects the credit, and the three alarms.
#
# A fresh account with 100 USD of credit and a demo that has to survive a
# hackathon. The expensive mistakes are not the ones that break the site; they
# are the ones that keep working while spending.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

resource "aws_sns_topic" "alarms" {
  name         = "${var.name_prefix}-alarms"
  display_name = "Fragility engine alarms"
}

resource "aws_sns_topic_subscription" "alarms" {
  for_each = toset(var.notification_emails)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

# --- The budget ---------------------------------------------------------------
#
# Notifications go to the addresses directly rather than through the topic
# above. AWS Budgets can publish to SNS, but doing so needs a topic policy
# granting budgets.amazonaws.com, and the only thing that buys here is one
# confirmation click fewer — against the risk of a misconfigured policy
# silently swallowing the one alert that matters.

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = toset(var.budget_alert_thresholds_usd)

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "ABSOLUTE_VALUE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.notification_emails
    }
  }

  # Forecast on the lowest threshold as well. Actual spend says the money is
  # gone; a forecast says it is going, which is the one that leaves time to act.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_alert_thresholds_usd[0]
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.notification_emails
  }
}

# --- Alarms -------------------------------------------------------------------

# The Go tier is the one that can fail in a way the interface cannot hide: it
# owns validation and the ledger, and a write never degrades.
#
# The threshold is a count rather than a ratio. At demo volume the two carry the
# same information, and a count fires on the first failure instead of waiting
# for a ratio to climb out of the noise of a handful of requests.
resource "aws_cloudwatch_metric_alarm" "domain_errors" {
  count = var.domain_function_name != null ? 1 : 0

  alarm_name        = "${var.name_prefix}-domain-errors"
  alarm_description = "The Go domain function returned an error."

  namespace   = "AWS/Lambda"
  metric_name = "Errors"
  statistic   = "Sum"
  dimensions  = { FunctionName = var.domain_function_name }

  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  period              = 300
  evaluation_periods  = 1

  # The functions are idle between demos. Without this, every quiet period would
  # put the alarm into INSUFFICIENT_DATA and train everyone to ignore it.
  treat_missing_data = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "engine_duration_p99" {
  alarm_name        = "${var.name_prefix}-engine-duration-p99"
  alarm_description = "The engine is answering slower than the front-end's fallback threshold."

  namespace          = "AWS/Lambda"
  metric_name        = "Duration"
  extended_statistic = "p99"
  dimensions         = { FunctionName = var.engine_function_name }

  comparison_operator = "GreaterThanThreshold"
  threshold           = var.engine_p99_duration_threshold_ms
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
}

# --- Cache hit rate -----------------------------------------------------------
#
# Off unless asked for: see the variable's description for why it is not free.

resource "aws_cloudfront_monitoring_subscription" "this" {
  count = var.enable_cache_hit_rate_alarm ? 1 : 0

  distribution_id = var.distribution_id

  monitoring_subscription {
    realtime_metrics_subscription_config {
      realtime_metrics_subscription_status = "Enabled"
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "cache_hit_rate" {
  count = var.enable_cache_hit_rate_alarm ? 1 : 0

  alarm_name        = "${var.name_prefix}-cache-hit-rate"
  alarm_description = "The CDN has stopped acting as the engine's memo table."

  namespace   = "AWS/CloudFront"
  metric_name = "CacheHitRate"
  statistic   = "Average"

  # CloudFront publishes to us-east-1 with a Global region dimension, whatever
  # the distribution's price class.
  dimensions = {
    DistributionId = var.distribution_id
    Region         = "Global"
  }

  comparison_operator = "LessThanThreshold"
  threshold           = 50
  period              = 900
  evaluation_periods  = 2
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]

  depends_on = [aws_cloudfront_monitoring_subscription.this]
}
