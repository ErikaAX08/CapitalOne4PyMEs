output "deploy_role_arn" {
  value       = aws_iam_role.deploy.arn
  description = <<-EOT
    Put this in the workflow as `role-to-assume`. It is an identifier, not a
    credential: it is useless without a GitHub token from the allowed repository
    and branch, which is why it can sit in the repository in plain sight.
  EOT
}

output "oidc_provider_arn" {
  value       = local.oidc_provider_arn
  description = "Pass create_oidc_provider = false on a second stack in the same account to reuse it."
}
