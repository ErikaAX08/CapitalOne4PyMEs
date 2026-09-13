# Bootstrap — the S3 bucket every other configuration keeps its state in.
#
# This is the one configuration with local state, and the one applied by hand:
# it cannot keep its state in the bucket it is creating. It runs once.
#
#   cd infra/bootstrap
#   terraform init
#   terraform apply -var 'state_bucket_name=fragility-tfstate-<suffix>'
#
# Then paste the `backend_block` output into infra/envs/prod/backend.tf.
#
# No DynamoDB table. Since Terraform 1.10 the S3 backend locks natively with
# `use_lockfile = true`, which is what docs/architecture.md decision 12 chose.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

provider "aws" {
  region = var.region

  # Without these four tags Cost Explorer is unreadable (infra/README.md).
  default_tags {
    tags = {
      Project    = var.project
      Owner      = var.owner
      Env        = "shared"
      CostCenter = var.cost_center
    }
  }
}

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # Losing this bucket means losing the record of everything Terraform manages,
  # which turns the next apply into a second set of resources rather than an
  # update of the existing ones.
  lifecycle {
    prevent_destroy = true
  }
}

# Versioning is what makes a corrupted or truncated state recoverable. It is not
# optional for a state bucket.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# State files are small but versioned on every apply. Expiring old versions
# keeps the bucket from growing without bound; 30 days is well past the point
# where a rollback is still plausible.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
