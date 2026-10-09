#!/usr/bin/env bash
# One-time server setup for an Ubuntu 24.04 VM. Safe to re-run.
#
#   ACME_EMAIL=you@example.com GITHUB_OWNER=your-github-name bash infra/bootstrap.sh
#
# Installs: swap, automatic security updates, k3s (Kubernetes + Traefik),
# cert-manager with a Let's Encrypt issuer, then the site manifests.
set -euo pipefail

: "${ACME_EMAIL:?Set ACME_EMAIL, the email that receives certificate expiry notices}"
: "${GITHUB_OWNER:?Set GITHUB_OWNER, the GitHub user or org that owns ghcr.io/<owner>/shiqi.si}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.18.2}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
# A fresh 1 GB node answers slowly at first, and cert-manager's webhook takes a
# moment to accept requests; retry instead of failing the whole run.
retry() {
  local i
  for i in 1 2 3 4 5 6; do
    "$@" && return 0
    echo "Attempt $i failed; retrying in 20s..." >&2
    sleep 20
  done
  return 1
}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "Swap ($SWAP_SIZE): small VMs need it for k3s"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l "$SWAP_SIZE" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
  sudo sysctl --system >/dev/null
fi

log "Packages and automatic security updates"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades git curl
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

log "k3s"
if ! command -v k3s >/dev/null; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=metrics-server --write-kubeconfig-mode=600" sh -
fi
mkdir -p "$HOME/.kube"
sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"
export KUBECONFIG="$HOME/.kube/config"
grep -q 'KUBECONFIG' "$HOME/.bashrc" || echo 'export KUBECONFIG=$HOME/.kube/config' >>"$HOME/.bashrc"
grep -q 'alias k=' "$HOME/.bashrc" || echo 'alias k=kubectl' >>"$HOME/.bashrc"
# The node registers a few seconds after k3s starts; `wait` fails if none exist yet.
until kubectl get node -o name 2>/dev/null | grep -q node/; do sleep 2; done
kubectl wait --for=condition=Ready node --all --timeout=180s

log "cert-manager $CERT_MANAGER_VERSION"
retry kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"
retry kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=300s

log "Let's Encrypt issuer"
cat >"$TMP/issuer.yaml" <<YAML
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${ACME_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-account
    solvers:
      - http01:
          ingress:
            ingressClassName: traefik
YAML
retry kubectl apply -f "$TMP/issuer.yaml"

log "Site: web + Redis + ingress"
kubectl kustomize "$REPO_DIR/infra/k8s/base" | sed "s#ghcr.io/OWNER/#ghcr.io/${GITHUB_OWNER,,}/#" >"$TMP/site.yaml"
retry kubectl apply -f "$TMP/site.yaml"
kubectl -n shiqi rollout status deploy/web --timeout=300s || true

log "Done"
kubectl -n shiqi get pods,ingress,certificate
echo
echo "Check https://shiqi.si in a minute or two, once the certificate shows READY=True."
