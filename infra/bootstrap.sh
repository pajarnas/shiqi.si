#!/usr/bin/env bash
# One-time server setup for an Ubuntu 24.04 VM with 1 GB of RAM. Safe to re-run.
#
#   ACME_EMAIL=you@example.com GITHUB_OWNER=your-github-name bash infra/bootstrap.sh
#
# Installs: swap, automatic security updates, Docker, then runs the site,
# Redis and Caddy (HTTPS) with Docker Compose. For a bigger node running
# Kubernetes, see infra/k8s/bootstrap-k3s.sh.
set -euo pipefail

: "${ACME_EMAIL:?Set ACME_EMAIL, the email that receives certificate expiry notices}"
: "${GITHUB_OWNER:?Set GITHUB_OWNER, the GitHub user or org that owns ghcr.io/<owner>/shiqi.si}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/server" && pwd)"
APT=(sudo DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=900)

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

log "Swap ($SWAP_SIZE)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l "$SWAP_SIZE" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
  sudo sysctl --system >/dev/null
fi

# An earlier version of this script installed k3s, which needs more memory
# than this VM has. Remove it so Docker gets the ports and the RAM.
if [ -x /usr/local/bin/k3s-uninstall.sh ]; then
  log "Removing k3s"
  sudo /usr/local/bin/k3s-uninstall.sh
fi

log "Packages, Docker and automatic security updates"
"${APT[@]}" update -y
"${APT[@]}" upgrade -y
"${APT[@]}" install -y unattended-upgrades git curl docker.io docker-compose-v2
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
sudo systemctl enable --now docker
# Lets this user (and CI over SSH) run docker without sudo from the next login.
sudo usermod -aG docker "$USER"

log "Settings ($SERVER_DIR/.env)"
umask 077
# Keep the admin password across re-runs; make one up the first time.
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(sed -n 's/^ADMIN_PASSWORD=//p' "$SERVER_DIR/.env" 2>/dev/null || true)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 16)}"
cat >"$SERVER_DIR/.env" <<ENV
IMAGE=ghcr.io/${GITHUB_OWNER,,}/shiqi.si:latest
ACME_EMAIL=${ACME_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ENV

log "Start the site"
cd "$SERVER_DIR"
sudo docker compose pull
sudo docker compose up -d --remove-orphans

log "Waiting for the site to answer"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null -H 'Host: shiqi.si' http://127.0.0.1/ 2>/dev/null ||
    sudo docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

log "Done"
sudo docker compose ps
free -h
echo
echo "Open https://shiqi.si once DNS points here; Caddy fetches the certificate on the first visit."
echo "Visitor log: https://shiqi.si/admin/visits (password: grep ADMIN_PASSWORD $SERVER_DIR/.env)"
