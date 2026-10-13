#!/usr/bin/env bash
# A private certificate authority for logging in to Kafka, MySQL and RabbitMQ from your
# own computer with a client certificate (mutual TLS). Run from anywhere on the
# server; everything lives in infra/server/certs/ (never in git).
#
#   bash certs.sh server       CA + server certificate, copied where Kafka, MySQL
#                              and RabbitMQ read them (deploy.sh runs this; safe to re-run)
#   bash certs.sh sign NAME    sign the CSR on stdin for /CN=NAME, print the
#                              certificate, and give MySQL and RabbitMQ a user
#                              NAME that logs in with it (infra/local/connect.sh calls this)
#   bash certs.sh ca           print the CA certificate
#   bash certs.sh list         who has been given a certificate
#
# Kafka's EXTERNAL listeners, MySQL and RabbitMQ are published on the server's localhost
# only, so the certificate works through an SSH tunnel; nothing new is open to
# the internet. A certificate is accepted by Kafka until it expires (no
# revocation list): to cut everyone off, delete certs/ca and re-sign.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
umask 077

DIR=certs
CA_NAME='shiqi.si private CA'
# Names the server certificate answers to; clients check this against the
# host they dialed. Override with SERVER_NAMES="a.example b.example".
SERVER_NAMES="${SERVER_NAMES:-shiqi.si localhost}"
# Any image already on the server will do to copy files with the right owner;
# MySQL always runs, so its image is always there.
HELPER_IMAGE=mysql:8.4

mkdir -p "$DIR/ca" "$DIR/server" "$DIR/issued"
chmod 755 "$DIR"

newkey() { openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$1"; }

ensure_ca() {
  [ -s "$DIR/ca/ca.key" ] && return
  newkey "$DIR/ca/ca.key"
  openssl req -x509 -new -key "$DIR/ca/ca.key" -sha256 -days 3650 -subj "/CN=$CA_NAME" \
    -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign' -out "$DIR/ca/ca.crt"
  echo "certs: created the CA" >&2
}

# Signs $1 (a CSR file) into $2 with the extensions in $3, valid $4 days.
sign_csr() {
  openssl x509 -req -in "$1" -CA "$DIR/ca/ca.crt" -CAkey "$DIR/ca/ca.key" -CAcreateserial \
    -sha256 -days "$4" -extfile <(printf '%s\n' "$3") -out "$2" 2>/dev/null
}

ensure_server() {
  local san names=() n
  for n in $SERVER_NAMES; do names+=("DNS:$n"); done
  san="$(IFS=,; echo "${names[*]}")"
  # Re-issue when missing, close to expiry, from an older CA, or the names changed.
  if [ -s "$DIR/server/server.crt" ] &&
    openssl verify -CAfile "$DIR/ca/ca.crt" "$DIR/server/server.crt" >/dev/null 2>&1 &&
    openssl x509 -in "$DIR/server/server.crt" -noout -checkend $((30 * 86400)) >/dev/null &&
    [ "$(cat "$DIR/server/names" 2>/dev/null)" = "$san" ]; then
    return
  fi
  newkey "$DIR/server/server.key"
  openssl req -new -key "$DIR/server/server.key" -subj "/CN=${SERVER_NAMES%% *}" \
    -out "$DIR/server/server.csr"
  sign_csr "$DIR/server/server.csr" "$DIR/server/server.crt" "basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$san" 825
  echo "$san" >"$DIR/server/names"
  echo "certs: issued the server certificate for $san" >&2
}

# SQL MySQL runs as root on every start (--init-file): one user per issued
# certificate, who logs in with that certificate and no password.
mysql_init() {
  local name require
  for name in $(ls "$DIR/issued" | sed -n 's/\.crt$//p'); do
    require="REQUIRE SUBJECT '/CN=$name' AND ISSUER '/CN=$CA_NAME'"
    echo "CREATE USER IF NOT EXISTS '$name'@'%' IDENTIFIED BY '' $require;"
    echo "ALTER USER '$name'@'%' IDENTIFIED BY '' $require;"
    echo "GRANT ALL PRIVILEGES ON \`shiqi\`.* TO '$name'@'%';"
  done
  # An empty file is fine; MySQL needs it to exist.
  echo "DO 0;"
}

# RabbitMQ's password hash: base64(salt + SHA-256(salt + password)), 4-byte salt.
rabbit_hash() {
  local salt
  salt="$(mktemp)"
  head -c 4 /dev/urandom >"$salt"
  { cat "$salt"; { cat "$salt"; printf '%s' "$1"; } | openssl dgst -sha256 -binary; } | base64
  rm -f "$salt"
}

# The value of NAME in .env (ensure-env.sh makes the RabbitMQ passwords).
env_value() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1; }

# RabbitMQ's definitions.json, imported on every start: `admin` (management
# UI, password in .env), `web` (the site, read-only monitoring), one user per
# issued certificate (no password: EXTERNAL login with that certificate only),
# and the lab topology the /rabbitmq page shows.
rabbitmq_definitions() {
  local users=() perms=() name admin web
  # user NAME HASH TAG / perm NAME CONFIGURE_AND_WRITE READ, as JSON objects.
  user() {
    users+=("{\"name\":\"$1\",\"password_hash\":\"$2\",\"hashing_algorithm\":\"rabbit_password_hashing_sha256\",\"tags\":[\"$3\"]}")
  }
  perm() {
    perms+=("{\"user\":\"$1\",\"vhost\":\"/\",\"configure\":\"$2\",\"write\":\"$2\",\"read\":\"$3\"}")
  }
  admin="$(env_value RABBITMQ_ADMIN_PASSWORD)"
  web="$(env_value RABBITMQ_WEB_PASSWORD)"
  if [ -n "$admin" ]; then
    user admin "$(rabbit_hash "$admin")" administrator
    perm admin '.*' '.*'
  fi
  if [ -n "$web" ]; then
    user web "$(rabbit_hash "$web")" monitoring
    perm web '^$' '^$'
  fi
  for name in $(ls "$DIR/issued" | sed -n 's/\.crt$//p'); do
    user "$name" "" management
    perm "$name" '.*' '.*'
  done
  local IFS=,
  cat <<EOF
{
  "users": [${users[*]}],
  "vhosts": [{"name": "/"}],
  "permissions": [${perms[*]}],
  "exchanges": [
    {"name": "lab.orders", "vhost": "/", "type": "topic", "durable": true, "auto_delete": false, "internal": false, "arguments": {}},
    {"name": "lab.dlx", "vhost": "/", "type": "fanout", "durable": true, "auto_delete": false, "internal": false, "arguments": {}}
  ],
  "queues": [
    {"name": "lab.billing", "vhost": "/", "durable": true, "auto_delete": false,
     "arguments": {"x-queue-type": "quorum", "x-dead-letter-exchange": "lab.dlx", "x-delivery-limit": 5}},
    {"name": "lab.shipping", "vhost": "/", "durable": true, "auto_delete": false,
     "arguments": {"x-queue-type": "classic", "x-dead-letter-exchange": "lab.dlx"}},
    {"name": "lab.audit", "vhost": "/", "durable": true, "auto_delete": false,
     "arguments": {"x-queue-type": "classic", "x-max-length": 1000}},
    {"name": "lab.dead", "vhost": "/", "durable": true, "auto_delete": false,
     "arguments": {"x-queue-type": "classic", "x-max-length": 1000}}
  ],
  "bindings": [
    {"source": "lab.orders", "vhost": "/", "destination": "lab.billing", "destination_type": "queue", "routing_key": "order.created", "arguments": {}},
    {"source": "lab.orders", "vhost": "/", "destination": "lab.shipping", "destination_type": "queue", "routing_key": "order.paid", "arguments": {}},
    {"source": "lab.orders", "vhost": "/", "destination": "lab.audit", "destination_type": "queue", "routing_key": "#", "arguments": {}},
    {"source": "lab.dlx", "vhost": "/", "destination": "lab.dead", "destination_type": "queue", "routing_key": "", "arguments": {}}
  ]
}
EOF
}

# Copies $3... into $DIR/$1, owned by $2 (the uid:gid the service runs as;
# Kafka 1000, MySQL and RabbitMQ 999), via a container because that user isn't us.
publish() {
  local target="$1" owner="$2" staging
  shift 2
  staging="$(mktemp -d)"
  cp "$@" "$staging/"
  mkdir -p "$DIR/$target"
  docker run --rm -u 0 --entrypoint sh -v "$staging:/in:ro" -v "$PWD/$DIR/$target:/out" \
    "$HELPER_IMAGE" -c "rm -f /out/* && cp /in/* /out/ && chown $owner /out/* &&
      chmod 755 /out && chmod 600 /out/* && chmod 644 /out/ca.crt" \
    >/dev/null
  rm -rf "$staging"
}

sync_services() {
  local tmp
  tmp="$(mktemp -d "$DIR/tmp.XXXX")"
  cp "$DIR/ca/ca.crt" "$DIR/server/server.crt" "$DIR/server/server.key" "$tmp/"
  # Kafka reads one PEM with the key and its certificate chain.
  cat "$DIR/server/server.key" "$DIR/server/server.crt" "$DIR/ca/ca.crt" >"$tmp/server.pem"
  mysql_init >"$tmp/init.sql"
  publish kafka 1000:1000 "$tmp/ca.crt" "$tmp/server.pem"
  publish mysql 999:999 "$tmp/ca.crt" "$tmp/server.crt" "$tmp/server.key" "$tmp/init.sql"
  rabbitmq_definitions >"$tmp/definitions.json"
  publish rabbitmq 999:999 "$tmp/ca.crt" "$tmp/server.crt" "$tmp/server.key" "$tmp/definitions.json"
  rm -rf "$tmp"
  cp "$DIR/ca/ca.crt" "$DIR/ca.crt"
  chmod 644 "$DIR/ca.crt"
}

case "${1:-}" in
server)
  ensure_ca
  ensure_server
  sync_services
  ;;
sign)
  name="${2:-}"
  [[ "$name" =~ ^[a-z][a-z0-9_-]{0,31}$ ]] || { echo "usage: certs.sh sign NAME < NAME.csr  (NAME: a-z, 0-9, _ -)" >&2; exit 2; }
  [ "$name" != shiqi ] || { echo "certs: 'shiqi' is the app's own MySQL user" >&2; exit 2; }
  ensure_ca
  csr="$(mktemp)"
  trap 'rm -f "$csr"' EXIT
  cat >"$csr"
  openssl req -in "$csr" -noout -verify 2>/dev/null || { echo "certs: not a valid CSR" >&2; exit 1; }
  subject="$(openssl req -in "$csr" -noout -subject -nameopt RFC2253)"
  [ "$subject" = "subject=CN=$name" ] || { echo "certs: CSR subject is '${subject#subject=}', expected CN=$name" >&2; exit 1; }
  sign_csr "$csr" "$DIR/issued/$name.crt" "basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=clientAuth" 365
  ensure_server
  sync_services
  # MySQL and RabbitMQ read the new user from their files when they start.
  docker compose restart mysql >&2
  [ -z "$(docker compose ps -q rabbitmq 2>/dev/null)" ] || docker compose restart rabbitmq >&2
  cat "$DIR/issued/$name.crt"
  ;;
ca)
  ensure_ca
  cat "$DIR/ca/ca.crt"
  ;;
list)
  for crt in "$DIR"/issued/*.crt; do
    [ -e "$crt" ] || continue
    printf '%s\t%s\n' "$(basename "$crt" .crt)" "$(openssl x509 -in "$crt" -noout -enddate)"
  done
  ;;
*)
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
  ;;
esac
