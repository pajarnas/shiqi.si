#!/usr/bin/env bash
# One-time server setup for an Ubuntu 24.04 VM. Safe to re-run.
#
#   ACME_EMAIL=you@example.com GITHUB_OWNER=your-github-name bash infra/bootstrap.sh
#
# Installs: swap, automatic security updates, k3s (Kubernetes + Traefik),
# Traefik's Let's Encrypt resolver, then the site manifests.
set -euo pipefail

: "${ACME_EMAIL:?Set ACME_EMAIL, the email that receives certificate expiry notices}"
: "${GITHUB_OWNER:?Set GITHUB_OWNER, the GitHub user or org that owns ghcr.io/<owner>/shiqi.si}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
# A fresh 1 GB node answers slowly at first and can time out requests for a
# while; retry instead of failing the whole run.
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
sudo apt-get -o DPkg::Lock::Timeout=900 update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=900 upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=900 install -y unattended-upgrades git curl
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

log "Traefik settings: Let's Encrypt via Traefik's built-in ACME"
# k3s applies everything in this folder at start-up. Writing it before k3s
# installs means Traefik comes up with the certificate resolver already set.
# Traefik does ACME itself, which saves the three cert-manager pods that a
# 1 GB node cannot spare.
sudo mkdir -p /var/lib/rancher/k3s/server/manifests
sudo tee /var/lib/rancher/k3s/server/manifests/traefik-config.yaml >/dev/null <<YAML
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    persistence:
      enabled: true
      size: 128Mi
      storageClass: local-path
    certificatesResolvers:
      le:
        acme:
          email: ${ACME_EMAIL}
          storage: /data/acme.json
          httpChallenge:
            entryPoint: web
YAML

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
# The API server and the node take a while to come up on a small VM.
wait_for() {
  local what="$1" deadline=$((SECONDS + 600))
  shift
  echo "Waiting for $what (up to 10 minutes)..."
  until "$@" >/dev/null 2>&1; do
    ((SECONDS < deadline)) || { echo "Timed out waiting for $what" >&2; return 1; }
    sleep 5
  done
}
wait_for "the Kubernetes API" kubectl get --raw /readyz
wait_for "the node to register" bash -c 'kubectl get node -o name | grep -q node/'
retry kubectl wait --for=condition=Ready node --all --timeout=180s

# Earlier versions of this script installed cert-manager; remove it to free memory.
if kubectl get namespace cert-manager >/dev/null 2>&1; then
  log "Removing cert-manager (Traefik handles certificates now)"
  kubectl delete validatingwebhookconfiguration,mutatingwebhookconfiguration cert-manager-webhook --ignore-not-found
  retry kubectl delete namespace cert-manager --ignore-not-found --timeout=300s
  kubectl get crd -o name | grep 'cert-manager.io' | xargs -r kubectl delete
fi

log "Site: web + Redis + ingress"
# Traefik's CRDs (Middleware etc.) arrive a little after the node is Ready.
wait_for "Traefik's CRDs" kubectl get crd middlewares.traefik.io
kubectl kustomize "$REPO_DIR/infra/k8s/base" | sed "s#ghcr.io/OWNER/#ghcr.io/${GITHUB_OWNER,,}/#" >"$TMP/site.yaml"
retry kubectl apply -f "$TMP/site.yaml"
kubectl -n shiqi rollout status deploy/web --timeout=300s || true

log "Done"
kubectl -n shiqi get pods,ingress
echo
echo "Check https://shiqi.si in a minute or two, once Traefik has fetched the certificate."
