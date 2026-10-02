#!/bin/sh
# Name: acme-renew.sh
# Purpose: Issues and renews Bluz's TLS certificate from an ACME server (#803),
#          e.g. the target network's own Let's Encrypt-compatible CA, then
#          copies it to nginx/ssl where the proxy picks it up.
# Created: 2026-10-02
# Author: Michael K. Steinberg
#
# Runs as the `certbot` service (compose profile `acme`). HTTP-01 over the
# proxy: nginx serves /.well-known/acme-challenge/ from the shared webroot, so
# the ACME server must reach this host on port 80.
#
# Env: ACME_DIRECTORY_URL, ACME_DOMAIN (required); ACME_EMAIL, ACME_RENEW_HOURS,
#      REQUESTS_CA_BUNDLE (the ACME server's own private CA, if any).
set -eu

: "${ACME_DIRECTORY_URL:?ACME_DIRECTORY_URL is not set (the ACME server's directory URL)}"
: "${ACME_DOMAIN:?ACME_DOMAIN is not set}"
RENEW_HOURS="${ACME_RENEW_HOURS:-12}"
WEBROOT=/var/www/acme
SSL_DIR=/etc/nginx/ssl
LIVE="/etc/letsencrypt/live/${ACME_DOMAIN}"

if [ -n "${ACME_EMAIL:-}" ]; then
    contact="--email ${ACME_EMAIL}"
else
    contact="--register-unsafely-without-email"
fi

# Copy only when the issued cert differs, so the proxy reloads only on change.
install_cert() {
    [ -f "${LIVE}/fullchain.pem" ] || return 0
    if ! cmp -s "${LIVE}/fullchain.pem" "${SSL_DIR}/cert.pem"; then
        cp "${LIVE}/fullchain.pem" "${SSL_DIR}/cert.pem.new"
        cp "${LIVE}/privkey.pem" "${SSL_DIR}/key.pem.new"
        chmod 600 "${SSL_DIR}/key.pem.new"
        # Key first: the proxy watches cert.pem and must never see a new cert
        # beside the old key.
        mv "${SSL_DIR}/key.pem.new" "${SSL_DIR}/key.pem"
        mv "${SSL_DIR}/cert.pem.new" "${SSL_DIR}/cert.pem"
        echo "acme: installed new certificate for ${ACME_DOMAIN}"
    fi
}

mkdir -p "${WEBROOT}"
while :; do
    # shellcheck disable=SC2086
    if certbot certonly --webroot -w "${WEBROOT}" \
        --server "${ACME_DIRECTORY_URL}" \
        -d "${ACME_DOMAIN}" ${contact} \
        --agree-tos --non-interactive --keep-until-expiring; then
        install_cert
    else
        echo "acme: issuance/renewal failed; retrying in ${RENEW_HOURS}h" >&2
    fi
    sleep "$((RENEW_HOURS * 3600))"
done
