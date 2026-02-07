terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig
  config_context = var.context
}

variable "kubeconfig" {
  type        = string
  description = "Path to kubeconfig"
  default     = "~/.kube/config"
}

variable "context" {
  type        = string
  description = "Kubernetes context"
  default     = null
}

resource "kubernetes_namespace" "huemn" {
  metadata {
    name = "huemn"
  }
}

resource "kubernetes_manifest" "backend" {
  manifest = yamldecode(file("${path.module}/../../../../deploy/k8s/backend.yaml"))
  depends_on = [kubernetes_namespace.huemn]
}

resource "kubernetes_manifest" "frontend" {
  manifest = yamldecode(file("${path.module}/../../../../deploy/k8s/frontend.yaml"))
  depends_on = [kubernetes_namespace.huemn]
}

resource "kubernetes_manifest" "redis" {
  manifest = yamldecode(file("${path.module}/../../../../deploy/k8s/redis.yaml"))
  depends_on = [kubernetes_namespace.huemn]
}

resource "kubernetes_manifest" "postgres" {
  manifest = yamldecode(file("${path.module}/../../../../deploy/k8s/postgres.yaml"))
  depends_on = [kubernetes_namespace.huemn]
}

resource "kubernetes_manifest" "ingress" {
  manifest = yamldecode(file("${path.module}/../../../../deploy/k8s/ingress.yaml"))
  depends_on = [kubernetes_namespace.huemn]
}
