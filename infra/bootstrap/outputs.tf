output "state_bucket_name" {
  value       = aws_s3_bucket.state.id
  description = "The bucket infra/envs/prod keeps its state in."
}

output "backend_block" {
  description = "Paste this into infra/envs/prod/backend.tf — a backend block cannot read a variable."

  value = <<-EOT
    terraform {
      backend "s3" {
        bucket       = "${aws_s3_bucket.state.id}"
        key          = "prod/terraform.tfstate"
        region       = "${var.region}"
        encrypt      = true
        use_lockfile = true
      }
    }
  EOT
}
