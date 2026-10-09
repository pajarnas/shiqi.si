#!/usr/bin/env bash
# Roll the web deployment to a given image tag. Run on the server (CI does this over SSH).
#   bash infra/deploy.sh ghcr.io/<owner>/shiqi.si:<sha>
set -euo pipefail
IMAGE="${1:?usage: deploy.sh <image>}"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
kubectl -n shiqi set image deploy/web web="$IMAGE"
kubectl -n shiqi rollout status deploy/web --timeout=300s
