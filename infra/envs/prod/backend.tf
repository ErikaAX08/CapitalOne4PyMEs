# State lives in the bucket infra/bootstrap creates.
#
# Native S3 locking, no DynamoDB table: since Terraform 1.10 the backend takes a
# lock by writing a lockfile next to the state (docs/architecture.md decision 12).
#
# `bucket` is deliberately absent. A backend block cannot read a variable, and
# the bucket name carries a globally unique suffix that does not belong in a
# committed file, so it arrives as partial configuration instead:
#
#   cp backend.hcl.example backend.hcl     # fill in the bucket name, once
#   terraform init -backend-config=backend.hcl
#
# backend.hcl is gitignored along with the rest of *.local-shaped configuration.

terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
