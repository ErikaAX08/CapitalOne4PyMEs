output "bucket_name" {
  value       = aws_s3_bucket.site.id
  description = "Where `pnpm build` output is synced on deploy."
}

output "bucket_arn" {
  value       = aws_s3_bucket.site.arn
  description = "Used by the cicd module to scope the deploy role's S3 permissions."
}

output "distribution_id" {
  value       = aws_cloudfront_distribution.site.id
  description = "The deploy must invalidate this distribution; without it the previous version keeps being served."
}

output "distribution_arn" {
  value       = aws_cloudfront_distribution.site.arn
  description = "Used by the cicd module to scope the invalidation permission."
}

output "site_url" {
  value       = local.custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
  description = "What to open, and what the post-deploy warming requests hit."
}
