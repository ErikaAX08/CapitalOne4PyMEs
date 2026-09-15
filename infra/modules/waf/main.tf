# waf — rate limiting for the public distribution.
#
# This reverses a documented decision. docs/architecture.md rejected a WAF on
# cost grounds, and for a demo nobody had the URL to, that was right: 7 USD a
# month against a 100 USD credit buys nothing when the only traffic is the team.
#
# Publishing the link changes the arithmetic. The reserved concurrency and the
# stage throttle bound what the account can *spend*, and they do it well, but
# they bound it by refusing service — the throttle is per stage, not per client,
# so one caller saturating it takes the demo down for everyone watching. That is
# the failure mode a rate limit exists to prevent, and it is the one thing the
# other measures cannot do, because they cannot tell a jury from a script.
#
# Scope is CLOUDFRONT, so this must live in us-east-1. The whole stack already
# does, for the certificate.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

resource "aws_wafv2_web_acl" "site" {
  count = var.enable_waf ? 1 : 0

  name        = "${var.name_prefix}-site"
  description = "Per-IP rate limiting. Bounds one client, where the stage throttle bounds everyone at once."
  scope       = "CLOUDFRONT"

  # Allow by default. This is a rate limiter, not a filter: every rule below
  # blocks a specific abuse, and anything that matches none of them is a
  # legitimate request that must not be second-guessed.
  default_action {
    allow {}
  }

  # --- The analysis, and everything else under /v1 ---------------------------
  #
  # The tighter of the two, because these are the requests that cost money per
  # call rather than per byte: a cache miss here is a 2 GB Lambda invocation.
  #
  # The limit is per IP over the evaluation window, so 300 in five minutes is
  # one request per second sustained from a single address. Walking every
  # rehearsed scenario in the pitch is a few dozen calls, and the rehearsed ones
  # are cache hits that never reach the origin at all.
  rule {
    name     = "api-rate-limit"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.api_rate_limit
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300

        # Without this the rule would count static asset requests too, and a
        # single page load is around thirty of them — the limit would be spent
        # on the page that asks the question rather than on the questions.
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "STARTS_WITH"
            search_string         = "/v1/"

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-api-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # --- The static site -------------------------------------------------------
  #
  # A full load is about 3.7 MB, most of it the physics and three.js bundles,
  # and CloudFront bills for every byte it sends. Nothing else in this stack
  # caps that: the reserved concurrency protects the functions, not the CDN.
  #
  # Ten requests per second from one address is far above a human reading a
  # dashboard and far below what it takes to make the transfer bill matter. It
  # is deliberately loose, because an event shares one NAT and a shared address
  # must not look like an attacker.
  rule {
    name     = "site-rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.site_rate_limit
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-site-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-web-acl"
    sampled_requests_enabled   = true
  }
}
