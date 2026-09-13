# compute — the two functions, their roles, their log groups and the warming
# rule.
#
# Everything is arm64: Graviton is about 20% cheaper and both Go and NumPy run
# well on it (docs/architecture.md §8). Zip packaging, not a container image —
# that is what takes the Python cold start from 3-8 s down to about 1 s, and it
# is only possible because the PRD excludes CatBoost from the MVP.
#
# No VPC configuration anywhere in this file. There is nothing to isolate, and a
# NAT Gateway would cost a third of the budget (decision 9).

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
  engine_function_name = "${var.name_prefix}-engine"
  domain_function_name = "${var.name_prefix}-domain"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# =============================================================================
# The Python engine
# =============================================================================

resource "aws_iam_role" "engine" {
  name               = "${local.engine_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "engine" {
  statement {
    sid    = "WriteItsOwnLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    # Scoped to this function's own log group. `logs:CreateLogGroup` is
    # deliberately absent: the group is declared below, and a function that
    # cannot create one cannot create an unretained one by accident.
    resources = ["${aws_cloudwatch_log_group.engine.arn}:*"]
  }
}

resource "aws_iam_role_policy" "engine" {
  name   = "logs"
  role   = aws_iam_role.engine.id
  policy = data.aws_iam_policy_document.engine.json
}

resource "aws_cloudwatch_log_group" "engine" {
  name              = "/aws/lambda/${local.engine_function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "engine" {
  function_name = local.engine_function_name
  description   = "cash, simulation and tension. Pure function of its request."
  role          = aws_iam_role.engine.arn

  filename         = var.engine_package_path
  source_code_hash = filebase64sha256(var.engine_package_path)

  # engine/handler.py, module `engine.handler`, function `handler`. The zip that
  # package_lambda.sh builds puts `engine/` and `fixtures/` at its root, which is
  # also why ENGINE_COMPANY_PROFILE is not set: the default the handler computes
  # — parents[1]/fixtures/company_demo_agency.json — already resolves correctly
  # inside /var/task.
  handler       = "engine.handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]

  memory_size = var.engine_memory_mb
  timeout     = var.engine_timeout_seconds

  # Provisioned concurrency needs a published version to point at.
  publish = true

  environment {
    variables = {
      ENGINE_CUTOFF_DATE   = var.engine_cutoff_date
      ENGINE_CACHE_CONTROL = var.engine_cache_control
    }
  }

  # No tracing_config. X-Ray costs, and with two functions the correlation id
  # is enough (docs/architecture.md §11).

  depends_on = [aws_cloudwatch_log_group.engine]
}

resource "aws_lambda_provisioned_concurrency_config" "engine" {
  count = var.engine_provisioned_concurrency > 0 ? 1 : 0

  function_name                     = aws_lambda_function.engine.function_name
  qualifier                         = aws_lambda_function.engine.version
  provisioned_concurrent_executions = var.engine_provisioned_concurrency
}

# =============================================================================
# The Go domain
#
# Inert at count 0 until services/domain has a Lambda entry point.
# =============================================================================

resource "aws_iam_role" "domain" {
  count = var.enable_domain_lambda ? 1 : 0

  name               = "${local.domain_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# The AWS-managed key SecureString parameters are encrypted with. Decrypting is
# a separate permission from reading, and reading without it fails.
data "aws_kms_alias" "ssm" {
  name = "alias/aws/ssm"
}

data "aws_iam_policy_document" "domain" {
  count = var.enable_domain_lambda ? 1 : 0

  statement {
    sid    = "WriteItsOwnLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.domain[0].arn}:*"]
  }

  # "Least privilege: Go may invoke exactly one Python function"
  # (docs/architecture.md §8). Named resource, not a wildcard.
  statement {
    sid       = "InvokeExactlyOneEngineFunction"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.engine.arn]
  }

  statement {
    sid       = "ReadTheLedgerConnectionString"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.database_connection_string.arn]
  }

  statement {
    sid       = "DecryptThatParameter"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [data.aws_kms_alias.ssm.target_key_arn]
  }
}

resource "aws_iam_role_policy" "domain" {
  count = var.enable_domain_lambda ? 1 : 0

  name   = "domain"
  role   = aws_iam_role.domain[0].id
  policy = data.aws_iam_policy_document.domain[0].json
}

resource "aws_cloudwatch_log_group" "domain" {
  count = var.enable_domain_lambda ? 1 : 0

  name              = "/aws/lambda/${local.domain_function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "domain" {
  count = var.enable_domain_lambda ? 1 : 0

  function_name = local.domain_function_name
  description   = "scenario and risk. Validates, commits, translates, projects."
  role          = aws_iam_role.domain[0].arn

  filename         = var.domain_package_path
  source_code_hash = filebase64sha256(var.domain_package_path)

  # The Go custom runtime convention: the binary is named `bootstrap` at the
  # root of the zip and `handler` names it.
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = ["arm64"]

  memory_size = var.domain_memory_mb
  timeout     = var.domain_timeout_seconds

  environment {
    # Every name below except ENGINE_FUNCTION_NAME is read by
    # cmd/analysis/main.go today. DOMAIN_ADDR, DOMAIN_PYTHON and
    # DOMAIN_ENGINE_DIR are local-run concerns and are deliberately absent:
    # under Lambda the engine is reached by invoking the function above, not by
    # spawning python3.
    #
    # DOMAIN_CONTRACTS_DIR and DOMAIN_COMPANY_PROFILE are set rather than left
    # to main.go's default, which walks up from the working directory looking
    # for contracts/. Under Lambda the working directory is /var/task and there
    # is nothing above it, so the walk would fail. The packaging step therefore
    # has to place contracts/ and fixtures/ at the root of the zip, exactly as
    # services/engine/scripts/package_lambda.sh already does for the engine.
    #
    # ENGINE_FUNCTION_NAME is the one name here that no code reads yet. The Go
    # entry point does not exist, so nothing defines how it learns which
    # function to invoke; this is a proposal the entry point has to adopt, not
    # an observed contract. It is inert while enable_domain_lambda is false.
    variables = merge(
      {
        DOMAIN_CONTRACTS_DIR          = "/var/task/contracts"
        DOMAIN_COMPANY_PROFILE        = "/var/task/fixtures/company_demo_agency.json"
        DOMAIN_CUTOFF_DATE            = var.engine_cutoff_date
        DOMAIN_CACHE_CONTROL          = var.engine_cache_control
        DOMAIN_ENGINE_TIMEOUT_SECONDS = tostring(var.engine_timeout_seconds)
        ENGINE_FUNCTION_NAME          = aws_lambda_function.engine.function_name
      },
      var.domain_company_id != "" ? { DOMAIN_COMPANY_ID = var.domain_company_id } : {},
      var.database_connection_string != "" ? { DATABASE_CONNECTION_STRING = var.database_connection_string } : {},
    )
  }

  depends_on = [aws_cloudwatch_log_group.domain]
}

# =============================================================================
# The ledger's connection string
#
# The database itself is not managed here and never will be: it lives on Tiger
# Cloud — PostgreSQL with TimescaleDB — reached over TLS, which is what keeps
# decision 10 true and leaves no RDS, no Aurora and no VPC in this account.
#
# The value is configuration, not Terraform state (infra/README.md): it is
# written once with `aws ssm put-parameter` and Terraform never reads it back.
# =============================================================================

resource "aws_ssm_parameter" "database_connection_string" {
  name        = var.database_parameter_name
  description = "Tiger Cloud connection string for the movements ledger."
  type        = "SecureString"

  # A placeholder. The real value is put in out of band; `ignore_changes` is
  # what stops the next apply from overwriting it with this string, and is the
  # reason the secret never appears in a plan, a state file or a log.
  value = "unset"

  lifecycle {
    ignore_changes = [value]
  }
}

# =============================================================================
# Warming — measure 4 of docs/architecture.md §10
# =============================================================================

resource "aws_cloudwatch_event_rule" "warming" {
  count = var.enable_warming ? 1 : 0

  name                = "${var.name_prefix}-warming"
  description         = "Keeps both functions warm during the event. Negligible cost."
  schedule_expression = "rate(${var.warming_rate_minutes} minutes)"
}

resource "aws_cloudwatch_event_target" "warming_engine" {
  count = var.enable_warming ? 1 : 0

  rule      = aws_cloudwatch_event_rule.warming[0].name
  target_id = "engine"
  arn       = aws_lambda_function.engine.arn

  # An API Gateway v2 shaped event with an empty query string. That is a real
  # analysis, not a ping: engine/contracts.py `_coerce` returns `spec["default"]`
  # for every absent parameter and `request_from_query` defaults the action to
  # accept_project, so this computes the default parameterization end to end and
  # leaves the container warm with NumPy already imported.
  input = jsonencode({ queryStringParameters = {} })
}

resource "aws_lambda_permission" "warming_engine" {
  count = var.enable_warming ? 1 : 0

  statement_id  = "AllowInvokeFromWarmingRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.engine.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.warming[0].arn
}

resource "aws_cloudwatch_event_target" "warming_domain" {
  count = var.enable_warming && var.enable_domain_lambda ? 1 : 0

  rule      = aws_cloudwatch_event_rule.warming[0].name
  target_id = "domain"
  arn       = aws_lambda_function.domain[0].arn

  # UNVERIFIED, and the only thing in this module that is: the Go entry point
  # does not exist yet, so nothing says what shape it accepts. `GET /health` is
  # the cheapest route the HTTP server exposes today (cmd/analysis/server.go).
  # Confirm this against the handler when it is written.
  input = jsonencode({
    version        = "2.0"
    routeKey       = "GET /health"
    rawPath        = "/health"
    rawQueryString = ""
    headers        = {}
    requestContext = {
      http = {
        method = "GET"
        path   = "/health"
      }
    }
    isBase64Encoded = false
  })
}

resource "aws_lambda_permission" "warming_domain" {
  count = var.enable_warming && var.enable_domain_lambda ? 1 : 0

  statement_id  = "AllowInvokeFromWarmingRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.domain[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.warming[0].arn
}
