#!/usr/bin/env bash
# Run on your own computer (macOS or Linux) to log in to the server's Kafka,
# MySQL and RabbitMQ with your own certificate.
#
#   bash infra/local/connect.sh setup [NAME]   once: key + CSR here, the server
#                                              signs it over SSH; files go to ~/.shiqi
#   bash infra/local/connect.sh tunnel         keep running while you work: forwards Kafka
#                                              (19094/29094/39094), MySQL (13306), RabbitMQ (5671, 15672)
#   bash infra/local/connect.sh mysql          a MySQL shell (needs the tunnel)
#   bash infra/local/connect.sh kafka          prints how to use the Kafka CLI
#   bash infra/local/connect.sh rabbitmq       prints how to log in to RabbitMQ
#
# Your private key is made here and never leaves this computer; the server only
# sees the CSR. SSH goes to $SHIQI_SSH (default saige@shiqi.si).
set -euo pipefail

SSH_TARGET="${SHIQI_SSH:-saige@shiqi.si}"
DIR="${SHIQI_DIR:-$HOME/.shiqi}"
REMOTE_CERTS='bash ~/shiqi.si/infra/server/certs.sh'
# local:remote. MySQL on 13306 here so a local dev MySQL on 3306 doesn't clash.
FORWARDS=(19094:19094 29094:29094 39094:39094 13306:3306 5671:5671 15672:15672)

setup() {
  local name="${1:-saige}"
  mkdir -p "$DIR" && chmod 700 "$DIR" && cd "$DIR"
  umask 077
  if [ ! -s client.key ]; then
    # PKCS#8 (BEGIN PRIVATE KEY), which Kafka's PEM key store needs.
    openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out client.key
    echo "made a new private key: $DIR/client.key"
  fi
  openssl req -new -key client.key -subj "/CN=$name" -out client.csr
  echo "asking $SSH_TARGET to sign the CSR for CN=$name ..."
  ssh "$SSH_TARGET" "$REMOTE_CERTS sign $name" <client.csr >client.crt.new
  mv client.crt.new client.crt
  ssh "$SSH_TARGET" "$REMOTE_CERTS ca" >ca.crt
  openssl verify -CAfile ca.crt client.crt >/dev/null
  # Kafka's Java client reads the key and its certificate from one PEM file.
  cat client.key client.crt >client.pem
  cat >kafka.properties <<EOF
security.protocol=SSL
ssl.truststore.type=PEM
ssl.truststore.location=$DIR/ca.crt
ssl.keystore.type=PEM
ssl.keystore.location=$DIR/client.pem
EOF
  cat >my.cnf <<EOF
[client]
host=127.0.0.1
port=13306
user=$name
ssl-mode=VERIFY_CA
ssl-ca=$DIR/ca.crt
ssl-cert=$DIR/client.crt
ssl-key=$DIR/client.key
EOF
  echo "done: $(openssl x509 -in client.crt -noout -subject -enddate | tr '\n' ' ')"
  echo "next: bash $0 tunnel"
}

tunnel() {
  local args=() f
  for f in "${FORWARDS[@]}"; do args+=(-L "${f%%:*}:127.0.0.1:${f#*:}"); done
  echo "tunnel open (Ctrl-C to close): Kafka localhost:19094,29094,39094  MySQL 127.0.0.1:13306  RabbitMQ localhost:5671, UI http://localhost:15672"
  exec ssh -N -o ExitOnForwardFailure=yes "${args[@]}" "$SSH_TARGET"
}

case "${1:-}" in
setup) setup "${2:-}" ;;
tunnel) tunnel ;;
mysql) exec mysql --defaults-extra-file="$DIR/my.cnf" shiqi ;;
kafka)
  cat <<EOF
With the tunnel open and Kafka's CLI installed (brew install kafka):
  kafka-topics --bootstrap-server localhost:19094 --command-config $DIR/kafka.properties --list
  kafka-console-consumer --bootstrap-server localhost:19094 --consumer.config $DIR/kafka.properties --topic lab-orders --from-beginning
  kafka-metadata-quorum --bootstrap-server localhost:19094 --command-config $DIR/kafka.properties describe --status
Other clients: CA $DIR/ca.crt, certificate $DIR/client.crt, key $DIR/client.key.
EOF
  ;;
rabbitmq)
  # The management UI's admin password lives in the server's .env; keep a copy
  # here next to the certificate, readable only by you.
  if [ ! -s "$DIR/rabbitmq-admin" ]; then
    (umask 077 && ssh "$SSH_TARGET" \
      "sed -n 's/^RABBITMQ_ADMIN_PASSWORD=//p' ~/shiqi.si/infra/server/.env" >"$DIR/rabbitmq-admin")
  fi
  cat <<EOF
With the tunnel open:
  AMQPS   amqps://localhost:5671, login EXTERNAL: your certificate is your user, no password
          CA $DIR/ca.crt, certificate $DIR/client.crt, key $DIR/client.key
  Web UI  http://localhost:15672, user admin, password in $DIR/rabbitmq-admin
Try it from Python (pip install pika), publishing to the lab exchange:
  python3 -c "
import pika, ssl
ctx = ssl.create_default_context(cafile='$DIR/ca.crt')
ctx.load_cert_chain('$DIR/client.crt', '$DIR/client.key')
p = pika.ConnectionParameters('localhost', 5671, ssl_options=pika.SSLOptions(ctx, 'localhost'),
                              credentials=pika.credentials.ExternalCredentials())
with pika.BlockingConnection(p) as c:
    ch = c.channel()
    ch.basic_publish('lab.orders', 'order.created', b'hello')
    print(ch.basic_get('lab.audit', auto_ack=True)[2])
"
EOF
  ;;
*)
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
  ;;
esac
