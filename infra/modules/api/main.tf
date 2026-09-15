# api — the HTTP API, its routes, and the cache policy the analysis behaviour
# uses. An HTTP API rather than a REST API or a load balancer: one USD per
# million requests, and no 18 USD/month of ALB (docs/architecture.md §12).

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

locals {
  domain_enabled = var.domain_lambda_invoke_arn != null

  # `one()` rather than `[0]`. A conditional does not reliably stop Terraform
  # from evaluating the branch it does not take, and indexing a resource whose
  # count is zero is an error when it happens.
  domain_integration_id = one(aws_apigatewayv2_integration.domain[*].id)

  # Which function answers which route.
  #
  # With the Go tier deployed every route goes to it, because it owns the
  # contract: /v1/actions serves contracts/actions.schema.json verbatim, and
  # /v1/companies and /v1/movements need the database. Without it only the
  # analysis is answerable, by the Python engine directly.
  routes = local.domain_enabled ? {
    "GET /v1/analysis"   = local.domain_integration_id
    "GET /v1/actions"    = local.domain_integration_id
    "GET /v1/companies"  = local.domain_integration_id
    "GET /v1/movements"  = local.domain_integration_id
    "POST /v1/movements" = local.domain_integration_id
    "GET /health"        = local.domain_integration_id
    } : {
    "GET /v1/analysis" = aws_apigatewayv2_integration.engine.id
  }
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "GET /v1/analysis and the ledger routes, behind CloudFront."

  # No cors_configuration on purpose. Everything reaches this API through the
  # CloudFront distribution as a same-origin /v1/* request, and the Go service
  # already sets its own CORS headers (cmd/analysis/server.go). Configuring
  # them here too would emit access-control-allow-origin twice, which browsers
  # reject outright.
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.name_prefix}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn

    # Structured JSON from the first commit (docs/architecture.md §11).
    format = jsonencode({
      requestId               = "$context.requestId"
      ip                      = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      responseLatency         = "$context.responseLatency"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  # A bound on the bill rather than on the demo. A runaway client — or a warming
  # loop with a bug in it — cannot turn a 100 USD credit into a surprise.
  default_route_settings {
    throttling_rate_limit  = var.throttling_rate_limit
    throttling_burst_limit = var.throttling_burst_limit
  }
}

# --- Integrations -------------------------------------------------------------

resource "aws_apigatewayv2_integration" "engine" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.engine_lambda_invoke_arn
  payload_format_version = "2.0"

  # The engine answers in about a second warm and about a second more cold;
  # ten seconds is the same ceiling DOMAIN_ENGINE_TIMEOUT_SECONDS defaults to.
  timeout_milliseconds = 10000
}

resource "aws_apigatewayv2_integration" "domain" {
  count = local.domain_enabled ? 1 : 0

  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.domain_lambda_invoke_arn
  payload_format_version = "2.0"

  # Longer than the engine integration: the Go function's own budget for the
  # engine is ten seconds, so it needs room to return the timeout as an error
  # rather than be cut off mid-answer.
  timeout_milliseconds = 15000
}

resource "aws_apigatewayv2_route" "this" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.key
  target    = "integrations/${each.value}"
}

# --- Invoke permissions -------------------------------------------------------

resource "aws_lambda_permission" "engine" {
  # Only granted when the engine is what API Gateway actually calls. With the Go
  # tier deployed, the engine is reached by lambda:Invoke from Go and nothing
  # else may call it.
  count = local.domain_enabled ? 0 : 1

  statement_id  = "AllowInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.engine_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_lambda_permission" "domain" {
  count = local.domain_enabled ? 1 : 0

  statement_id  = "AllowInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.domain_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# --- The cache policy ---------------------------------------------------------
#
# The important piece, copied from docs/architecture.md §8.
#
# `query_string_behavior = "all"` is correct *because the response is
# deterministic*: the seed is an explicit query parameter, so the whole query
# string identifies the answer and every parameter belongs in the cache key.
# With an unseeded stochastic engine this would be a bug rather than the
# optimization that carries the demo.
#
# It is only half the argument, though. "Every parameter that changes the answer
# is in the key" does not give "every parameter in the key changes the answer",
# and the gap between the two is a cache-buster: the engine ignores unknown
# parameters, so `?seed=42&x=<counter>` is an unbounded supply of distinct keys
# for one identical response. The normalizing function below closes the gap by
# dropping those parameters before the cache lookup, which is what lets this
# policy stay `all`.

resource "aws_cloudfront_cache_policy" "analysis" {
  name        = "${var.name_prefix}-deterministic-analysis"
  comment     = "A pure function of its query string, so the CDN is a memo table for it."
  default_ttl = 3600
  max_ttl     = 86400
  min_ttl     = 60

  parameters_in_cache_key_and_forwarded_to_origin {
    query_strings_config {
      query_string_behavior = "all"
    }

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }

    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# --- Normalizing the cache key ------------------------------------------------

locals {
  actions_schema = jsondecode(file(coalesce(
    var.actions_schema_path,
    "${path.module}/../../../contracts/actions.schema.json",
  )))

  # Every query parameter `request_from_query` reads, taken from the contract
  # itself rather than restated here, plus the two the handler reads directly:
  # `action` selects the parameter set, `cutoff_date` dates the run.
  allowed_query_params = sort(distinct(concat(
    ["action", "cutoff_date"],
    [for p in local.actions_schema.run.parameters : p.id],
    [for p in local.actions_schema.stress.parameters : p.id],
    flatten([for a in values(local.actions_schema.actions) : [for p in a.parameters : p.id]]),
  )))
}

resource "aws_cloudfront_function" "normalize_analysis_query" {
  name    = "${var.name_prefix}-normalize-analysis-query"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Drops query parameters the engine does not read, so they cannot become distinct cache keys."

  code = templatefile("${path.module}/functions/normalize-analysis-query.js.tftpl", {
    allowed = jsonencode({ for id in local.allowed_query_params : id => true })
  })
}
