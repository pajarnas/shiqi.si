#!/usr/bin/env bash
# Switch the site to a given image. Run on the server (CI does this over SSH).
#   bash infra/deploy.sh ghcr.io/<owner>/shiqi.si:<sha>
# KEY=value lines on stdin (CI sends its GitHub Secrets this way) are written
# into server/secrets.env, replacing old values and keeping everything else.
set -euo pipefail
IMAGE="${1:?usage: deploy.sh <image>}"
cd "$(dirname "${BASH_SOURCE[0]}")/server"

if [ ! -t 0 ]; then
  umask 077
  touch secrets.env
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[A-Z][A-Z0-9_]*=. ]] || continue
    name="${line%%=*}"
    grep -v "^${name}=" secrets.env > secrets.env.tmp || true
    printf '%s\n' "$line" >> secrets.env.tmp
    mv secrets.env.tmp secrets.env
    echo "secrets.env: set ${name}"
  done
fi

source ./ensure-env.sh
sed -i "s|^IMAGE=.*|IMAGE=${IMAGE}|" .env
docker compose pull web
# Starts MySQL and Redis too if they aren't running yet.
docker compose up -d web
docker image prune -f >/dev/null
docker compose ps
