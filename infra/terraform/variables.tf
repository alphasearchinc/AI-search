variable "project_name" {
  description = "Short name prefix for all resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to your SSH public key file"
  type        = string
}

variable "admin_public_ip" {
  description = "Your public IP in CIDR notation for SSH access (e.g. 1.2.3.4/32)"
  type        = string
}

variable "vm_size" {
  description = "VM size"
  type        = string
  default     = "Standard_B2s"
}

# Uncomment if you want to hard-wire subscription in provider:
# variable "subscription_id" {
#   description = "Azure subscription ID"
#   type        = string
# }
