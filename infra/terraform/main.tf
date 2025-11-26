locals {
  common_tags = {
    project = var.project_name
    env     = "dev"
    owner   = "medusa-hybrid"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "${var.project_name}-rg"
  location = var.location

  tags = local.common_tags
}
