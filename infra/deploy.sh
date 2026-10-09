#!/usr/bin/env bash
# Switch the site to a given image. Run on the server (CI does this over SSH).
#   bash infra/deploy.sh ghcr.io/<owner>/shiqi.si:<sha>
set -euo pipefail
IMAGE="${1:?usage: deploy.sh <image>}"
cd "$(dirname "${BASH_SOURCE[0]}")/server"
sed -i "s|^IMAGE=.*|IMAGE=${IMAGE}|" .env
docker compose pull web
docker compose up -d web
docker image prune -f >/dev/null
docker compose ps web
