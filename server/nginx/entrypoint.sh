#!/bin/sh
# Генерирует конфиг nginx в зависимости от наличия DOMAIN и сертификатов.
# - DOMAIN задан + сертификаты на месте -> HTTPS (443) + редирект с 80.
# - Иначе -> plain HTTP на 80 без SSL.
# NOTE: выполняется через source главным entrypoint образа nginx,
# поэтому без set/exec — только генерация файла, nginx стартует сам.

PEER_PATH="${PEER_PATH:-/peerjs}"
OUT=/etc/nginx/conf.d/default.conf

if [ -n "${DOMAIN:-}" ] \
  && [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] \
  && [ -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]; then
  echo "[entrypoint] DOMAIN=${DOMAIN}, certs found -> HTTPS mode"
  cat > "$OUT" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    location ${PEER_PATH}/ {
        proxy_pass http://peerjs:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF
else
  echo "[entrypoint] no DOMAIN or no certs -> plain HTTP mode"
  cat > "$OUT" <<EOF
server {
    listen 80 default_server;

    location ${PEER_PATH}/ {
        proxy_pass http://peerjs:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF
fi
