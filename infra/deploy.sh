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

# Sets NAME=value in .env (or removes NAME when value is empty).
set_env() {
  grep -v "^$1=" .env >.env.tmp || true
  [ -z "$2" ] || printf '%s=%s\n' "$1" "$2" >>.env.tmp
  mv .env.tmp .env
}

# The Kafka cluster (compose profile `kafka`, ~1.5 GB) runs only with at least
# 3.5 GB of RAM, so this is safe to deploy to the 1 GB VM before it's resized.
# Both settings go in .env so a manual `docker compose up` does the same.
KAFKA_MIN_KB=3670016
mem_kb="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
if [ "${mem_kb:-0}" -ge "$KAFKA_MIN_KB" ]; then
  set_env COMPOSE_PROFILES kafka
  set_env KAFKA_BROKERS kafka-1:9092,kafka-2:9092,kafka-3:9092
  services=(kafka-1 kafka-2 kafka-3 web)
else
  set_env COMPOSE_PROFILES ''
  set_env KAFKA_BROKERS ''
  services=(web)
  # Shrunk back below the line: stop a cluster left from before (keeps its data).
  docker compose stop kafka-1 kafka-2 kafka-3 2>/dev/null || true
fi
echo "Kafka cluster: $([ ${#services[@]} -gt 1 ] && echo on || echo "off (needs 3.5 GB RAM)")"

docker compose pull "${services[@]}"
# Starts MySQL and Redis too if they aren't running yet.
docker compose up -d "${services[@]}"
docker image prune -f >/dev/null
docker compose ps
