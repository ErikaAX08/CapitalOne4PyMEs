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

      # The two CloudFront functions — the SPA router and the analysis cache-key
      # normalizer. `DescribeFunction` does not start with Get or List, so it is
      # not covered above and a plan that reads either function fails without it.
      # Update and Publish ship a new version when the code changes, which for
      # the normalizer means whenever contracts/actions.schema.json gains a
      # parameter. `CreateFunction` stays out, for the same reason
      # `lambda:CreateFunction` does: a deploy ships code, a human creates
      # infrastructure.
      "cloudfront:DescribeFunction",
      "cloudfront:UpdateFunction",
      "cloudfront:PublishFunction",
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

      # ListWebACLs supports no resource-level permission at all, so it can only
      # be granted here. The statements that actually touch the web ACL are
      # named and scoped below.
      "wafv2:ListWebACLs",
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
    sid    = "ManageTheWebAcl"
    effect = "Allow"

    # Update is granted where Create and Delete are not, on the same rule the
    # rest of this policy follows: a deploy adjusts what exists, a human brings
    # it into being. Changing a rate limit cannot widen anyone's access — the
    # worst it can do is stop blocking, which the CloudWatch metrics on each
    # rule make visible.
    #
    # Associate is here because CloudFront checks it when a distribution names
    # a web ACL, even though the call that does the associating is
    # UpdateDistribution.
    actions = [
      "wafv2:GetWebACL",
      "wafv2:UpdateWebACL",
      "wafv2:AssociateWebACL",
      "wafv2:TagResource",
      "wafv2:ListTagsForResource",
    ]

    resources = ["arn:aws:wafv2:${var.region}:${data.aws_caller_identity.current.account_id}:global/webacl/${var.name_prefix}-*/*"]
  }

  statement {
    sid    = "PassAndTagTheRolesItCreated"
    effect = "Allow"

    # Neither action can widen a permission: passing a role is gated by the
    # trust policy of the role being passed, and a tag grants nothing here
    # because no policy in this account keys off one.
    actions = [
      "iam:PassRole",
      "iam:TagRole",
    ]

    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*"]
  }

  statement {
    sid    = "WriteThePoliciesOfTheExecutionRolesOnly"
    effect = "Allow"

    actions = ["iam:PutRolePolicy"]

    # Named one by one rather than matched by `${var.name_prefix}-*`.
    #
    # The wildcard was the bug. This role is `${var.name_prefix}-deploy`, which
    # matches `${var.name_prefix}-*`, so the previous version of this statement
    # let the deploy write an inline policy onto *itself* — `Action: "*"` on
    # `Resource: "*"` is one PutRolePolicy call away, and from there the account
    # is open: any resource, any region, for as long as it goes unnoticed. The
    # comment that used to sit here claimed the opposite.
    #
    # The consequence of naming them is that a change to the deploy role's own
    # policy — this file — no longer applies from the pipeline and has to be run
    # by a human. That is the same rule the module already follows for creating
    # the functions and for writing the SSM parameter: a deploy ships code, it
    # does not rewrite its own permissions.
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-engine-role",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-domain-role",
    ]
  }

  statement {
    sid    = "NeverRewriteItsOwnPermissions"
    effect = "Deny"

    # Belt and braces. The Allow above is already scoped away from this role,
    # but an explicit Deny cannot be overridden by any Allow, so the escalation
    # stays closed even if someone later widens that list back to a wildcard.
    actions = [
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:UpdateAssumeRolePolicy",
      "iam:CreatePolicyVersion",
      "iam:SetDefaultPolicyVersion",
    ]

    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-deploy"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
