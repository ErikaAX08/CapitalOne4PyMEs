# prod — the only environment. `prod` and local, nothing in between
# (docs/architecture.md §15).

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

provider "aws" {
  # us-east-1 is not a preference. It is the lowest pricing, and CloudFront
  # accepts an ACM certificate from nowhere else.
  region = var.region

  # Without these four tags Cost Explorer cannot attribute a line item, and a
  # 100 USD credit is small enough that an unattributable line item matters.
  default_tags {
    tags = {
      Project    = var.project
      Owner      = var.owner
      Env        = "prod"
      CostCenter = var.cost_center
    }
  }
}

locals {
  # Relative to the root module directory, so the path is the same whether
  # Terraform is run from here or with -chdir from the repository root.
  repo_root = "${path.root}/../../.."

  engine_package_path = coalesce(var.engine_package_path, "${local.repo_root}/services/engine/build/engine.zip")
  domain_package_path = var.enable_domain_lambda ? coalesce(var.domain_package_path, "${local.repo_root}/services/domain/build/domain.zip") : null
}

# --- The functions ------------------------------------------------------------

module "compute" {
  source = "../../modules/compute"

  name_prefix = var.name_prefix

  engine_package_path            = local.engine_package_path
  engine_cutoff_date             = var.cutoff_date
  engine_provisioned_concurrency = var.engine_provisioned_concurrency

  enable_domain_lambda       = var.enable_domain_lambda
  domain_package_path        = local.domain_package_path
  domain_company_id          = var.domain_company_id
  database_connection_string = var.database_connection_string

  enable_warming = var.enable_warming
}

# --- The API ------------------------------------------------------------------

module "api" {
  source = "../../modules/api"

  name_prefix = var.name_prefix

  engine_lambda_invoke_arn    = module.compute.engine_invoke_arn
  engine_lambda_function_name = module.compute.engine_function_name

  # Both null until the Go entry point exists, which is what makes the api
  # module route everything to the engine instead.
  domain_lambda_invoke_arn    = module.compute.domain_invoke_arn
  domain_lambda_function_name = module.compute.domain_function_name
}

# --- The site -----------------------------------------------------------------

module "site" {
  source = "../../modules/site"

  name_prefix = var.name_prefix
  bucket_name = var.site_bucket_name

  api_origin_domain_name   = module.api.origin_domain_name
  analysis_cache_policy_id = module.api.analysis_cache_policy_id

  domain_name     = var.domain_name
  route53_zone_id = var.route53_zone_id
}

# --- CI/CD --------------------------------------------------------------------

module "cicd" {
  source = "../../modules/cicd"

  name_prefix       = var.name_prefix
  region            = var.region
  github_repository = var.github_repository
  allowed_branches  = var.allowed_branches

  state_bucket_name = var.state_bucket_name
  site_bucket_arn   = module.site.bucket_arn
  distribution_arn  = module.site.distribution_arn

  lambda_function_arns = [
    module.compute.engine_function_arn,
    module.compute.domain_function_arn,
  ]
}

# --- Guardrails ---------------------------------------------------------------

module "guardrails" {
  source = "../../modules/guardrails"

  name_prefix         = var.name_prefix
  notification_emails = var.notification_emails

  engine_function_name = module.compute.engine_function_name
  domain_function_name = module.compute.domain_function_name
  distribution_id      = module.site.distribution_id

  enable_cache_hit_rate_alarm = var.enable_cache_hit_rate_alarm
}
