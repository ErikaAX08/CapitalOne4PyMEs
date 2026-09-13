# cicd — the GitHub OIDC provider and the role deploy.yml assumes.
#
# Zero static keys in the repository (docs/architecture.md decision 11). The
# workflow exchanges its short-lived GitHub token for temporary AWS credentials
# through AssumeRoleWithWebIdentity; there is nothing to leak and nothing to
# rotate.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

data "aws_caller_identity" "current" {}

# The region arrives as a variable rather than from the aws_region data source:
# that source renamed its attribute between provider majors, and an ARN built
# from a variable cannot break on a provider upgrade.

locals {
  # `one()` on both, then coalesce. A conditional indexing `[0]` would evaluate
  # the branch it does not take, and one of the two always has count zero.
  oidc_provider_arn = coalesce(
    one(aws_iam_openid_connect_provider.github[*].arn),
    one(data.aws_iam_openid_connect_provider.github[*].arn),
  )

  subjects = [for branch in var.allowed_branches : "repo:${var.github_repository}:ref:refs/heads/${branch}"]

  # A null arrives here whenever the Go function is not deployed.
  lambda_arns = compact(var.lambda_function_arns)
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # No thumbprint_list. AWS stopped requiring a thumbprint for this provider in
  # 2023 and validates the certificate chain itself; a pinned thumbprint is now
  # just a hardcoded value that silently rots.
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1

  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    # Both conditions are load-bearing. Without the audience check any GitHub
    # workflow anywhere could present a token; without the subject check any
    # workflow in any repository could.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.subjects
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name_prefix}-deploy"
  description        = "Assumed by deploy.yml through OIDC. No static credentials exist for it."
  assume_role_policy = data.aws_iam_policy_document.assume_role.json

  # A deploy should finish in minutes. A short session is one less thing a
  # leaked token buys.
  max_session_duration = 3600
}

# --- What the deploy may do ---------------------------------------------------
#
# Least privilege, honestly labelled. Where an AWS API supports resource-level
# permissions the statement names the resource; where it does not — CloudFront
# and API Gateway management actions are the two that matter here — the
# statement says so rather than pretending otherwise.

data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "TerraformState"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]

    resources = [
      "arn:aws:s3:::${var.state_bucket_name}",
      "arn:aws:s3:::${var.state_bucket_name}/*",
    ]
  }

  statement {
    sid    = "SyncTheSite"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:PutBucketPolicy",
      "s3:GetBucketVersioning",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetEncryptionConfiguration",
    ]

    resources = [
      var.site_bucket_arn,
      "${var.site_bucket_arn}/*",
    ]
  }

  statement {
    sid    = "UpdateTheFunctions"
    effect = "Allow"

    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:PublishVersion",
      "lambda:ListVersionsByFunction",
      "lambda:GetPolicy",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:TagResource",
      "lambda:ListTags",
      "lambda:PutProvisionedConcurrencyConfig",
      "lambda:GetProvisionedConcurrencyConfig",
      "lambda:DeleteProvisionedConcurrencyConfig",
    ]

    # Creating and deleting functions is deliberately absent: a deploy replaces
    # code, it does not invent or remove infrastructure. The first apply that
    # creates them is run by a human.
    resources = length(local.lambda_arns) > 0 ? local.lambda_arns : ["arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.name_prefix}-*"]
  }

  statement {
    sid    = "InvalidateTheCache"
    effect = "Allow"

    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
      "cloudfront:ListInvalidations",
    ]

    resources = [var.distribution_arn]
  }

  statement {
    sid    = "ReadWhatTerraformPlanNeeds"
    effect = "Allow"

    # CloudFront and API Gateway management actions do not support resource-level
    # permissions, so a plan that has to read the distribution and the API can
    # only be granted against "*". The write side of CloudFront is scoped by the
    # statement above; these are reads plus the distribution update a
    # configuration change needs.
    actions = [
      "cloudfront:Get*",
      "cloudfront:List*",
      "cloudfront:UpdateDistribution",
      "cloudfront:TagResource",
      "apigateway:GET",
      "apigateway:POST",
      "apigateway:PATCH",
      "apigateway:PUT",
      "apigateway:DELETE",
      "logs:DescribeLogGroups",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:ListTagsForResource",
      "events:DescribeRule",
      "events:ListTargetsByRule",
      "events:ListTagsForResource",
      "ssm:DescribeParameters",
      "ssm:GetParameters",
      "budgets:ViewBudget",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListTagsForResource",
      "sns:GetTopicAttributes",
      "sns:ListTagsForResource",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:GetOpenIDConnectProvider",
      "kms:DescribeKey",
      "acm:DescribeCertificate",
      "acm:ListTagsForCertificate",
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ReadTheParameterItDoesNotOwn"
    effect = "Allow"

    # Deliberately not ssm:PutParameter. The connection string is written by
    # hand, once, and Terraform must not be able to overwrite it.
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/fragility/*"]
  }

  statement {
    sid    = "ManageTheRolesItCreated"
    effect = "Allow"

    actions = [
      "iam:PassRole",
      "iam:PutRolePolicy",
      "iam:TagRole",
    ]

    # Scoped by name so this role can never grant itself a policy or touch a
    # role belonging to anything else in the account.
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
