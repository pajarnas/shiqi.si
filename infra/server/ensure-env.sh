# Sourced by bootstrap.sh and deploy.sh from infra/server: makes sure .env has
# the passwords the server makes up for itself, creating missing ones and never
# changing existing ones. Secrets set by hand live in GitHub Secrets (APP_*),
# which CI writes to secrets.env instead.
ensure_env() {
  local name
  umask 077
  touch .env
  for name in "$@"; do
    grep -q "^${name}=." .env || {
      printf '%s=%s\n' "$name" "$(openssl rand -hex 16)" >> .env
      echo ".env: created ${name}"
    }
  done
}
ensure_env ADMIN_PASSWORD
