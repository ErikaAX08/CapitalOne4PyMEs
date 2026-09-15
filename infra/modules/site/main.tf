# site — the private bucket, the distribution in front of it, and the two
# behaviours that route /v1/* to the API.
#
# The bucket is never a public website: it is readable only by this
# distribution, through Origin Access Control (infra/README.md).

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
  # A certificate cannot be validated without a zone to write the record into,
  # so a domain on its own is not enough to turn the custom domain on.
  custom_domain = var.domain_name != "" && var.route53_zone_id != ""

  s3_origin_id  = "site-bucket"
  api_origin_id = "api-gateway"
}

# --- Managed policies ---------------------------------------------------------
#
# Looked up by name rather than by hardcoded id: the ids are stable, but a name
# is checkable by a reader and an id is not.

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

# --- The bucket ---------------------------------------------------------------

resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-site-oac"
  description                       = "Only this distribution may read the site bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "site" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    # Without this condition the policy would let *any* CloudFront distribution
    # in any account read the bucket.
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json

  depends_on = [aws_s3_bucket_public_access_block.site]
}

# --- Client-side routing ------------------------------------------------------

resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.name_prefix}-spa-router"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Serves index.html for client-side routes, on the site behaviour only."
  code    = file("${path.module}/functions/spa-router.js")
}

# --- The distribution ---------------------------------------------------------

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} — static site and /v1 API"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = local.custom_domain ? [var.domain_name] : []

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = var.api_origin_domain_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # The static site.
  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # The analysis. This behaviour is the reason the architecture works: the
  # engine is deterministic given a fixed seed, so the response is a pure
  # function of the query string and the CDN becomes a memo table for it
  # (docs/architecture.md §8). It is declared before /v1/* because CloudFront
  # evaluates ordered behaviours in order and the first match wins.
  ordered_cache_behavior {
    path_pattern           = "/v1/analysis*"
    target_origin_id       = local.api_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # The cache policy already forwards every query string to the origin, so no
    # origin request policy is needed and none is attached: attaching one that
    # also forwards query strings is rejected as a conflict.
    cache_policy_id = var.analysis_cache_policy_id

    # Runs before the cache lookup, which is the only place this can work: it
    # drops the parameters the engine ignores so that `?seed=42&x=1` and
    # `?seed=42&x=2` stop being two keys for one answer. Without it the policy
    # above hands anyone with the URL an unlimited supply of cache misses, and
    # every miss is a 2 GB Lambda invocation.
    function_association {
      event_type   = "viewer-request"
      function_arn = var.analysis_function_arn
    }
  }

  # Everything else under /v1: the ledger and the company catalogue. Both are
  # declared `no-store` by the origin (docs/architecture.md §5.4) and a write
  # must never be answered from a cache, so the cache is disabled outright
  # rather than left to the origin's headers — the analysis cache policy has
  # `min_ttl = 60`, which CloudFront honours *over* a no-store response header.
  ordered_cache_behavior {
    path_pattern           = "/v1/*"
    target_origin_id       = local.api_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.custom_domain ? null : true
    acm_certificate_arn            = one(aws_acm_certificate_validation.site[*].certificate_arn)
    ssl_support_method             = local.custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.custom_domain ? "TLSv1.2_2021" : null
  }
}

# --- Optional custom domain ---------------------------------------------------
#
# Inert unless both domain_name and route53_zone_id are set. The certificate
# lives in us-east-1 because CloudFront accepts no other region, which is the
# same reason the whole configuration is pinned there.

resource "aws_acm_certificate" "site" {
  count = local.custom_domain ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = local.custom_domain ? {
    for option in aws_acm_certificate.site[0].domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  count = local.custom_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

resource "aws_route53_record" "site" {
  count = local.custom_domain ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
