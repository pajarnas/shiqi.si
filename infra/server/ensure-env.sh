# Sourced by bootstrap.sh and deploy.sh from infra/server: makes sure .env has
# every generated secret, creating the ones that are missing. Existing values
# are never changed (MySQL keeps the passwords it was first set up with).
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
ensure_env ADMIN_PASSWORD MYSQL_PASSWORD MYSQL_ROOT_PASSWORD
