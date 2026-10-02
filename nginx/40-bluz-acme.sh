#!/bin/sh
# Name: 40-bluz-acme.sh
# Purpose: Turns on nginx's built-in ACME client (ngx_http_acme_module) when
#          ACME_DIRECTORY_URL is set, so the proxy issues and renews its own
#          certificate from the network's ACME server (#803).
# Created: 2026-10-02
# Author: Michael K. Steinberg
#
# Installed into /docker-entrypoint.d/, which the nginx image runs before it
# starts. Without ACME_DIRECTORY_URL it does nothing and the image's static
# snippets stay: TLS from /etc/nginx/ssl, as before.
#
# Env: ACME_DIRECTORY_URL, ACME_DOMAIN (required together); ACME_EMAIL,
#      ACME_CA_BUNDLE (the ACME server's own private CA, if any).
set -eu

[ -n "${ACME_DIRECTORY_URL:-}" ] || exit 0

: "${ACME_DOMAIN:?ACME_DOMAIN must be set with ACME_DIRECTORY_URL}"

SNIPPETS=/etc/nginx/bluz
STATE=/var/cache/nginx/acme-bluz

# The values land in nginx config: refuse anything that could end a directive.
for value in "$ACME_DIRECTORY_URL" "$ACME_DOMAIN" "${ACME_EMAIL:-}" "${ACME_CA_BUNDLE:-}"; do
    case "$value" in
        *[\;\{\}\"\'\ ]*)
            echo "40-bluz-acme.sh: ACME_* values must not contain spaces, quotes, ';' or braces" >&2
            exit 1
            ;;
    esac
done

# Account key, certificate and private key live here; a mounted host dir is
# root-owned, while the module writes from the nginx worker.
mkdir -p "$STATE"
chown nginx:nginx "$STATE"
chmod 700 "$STATE"

{
    echo "acme_issuer bluz {"
    echo "    uri ${ACME_DIRECTORY_URL};"
    [ -n "${ACME_EMAIL:-}" ] && echo "    contact ${ACME_EMAIL};"
    [ -n "${ACME_CA_BUNDLE:-}" ] && echo "    ssl_trusted_certificate ${ACME_CA_BUNDLE};"
    echo "    state_path ${STATE};"
    echo "    accept_terms_of_service;"
    echo "}"
    echo "acme_shared_zone zone=ngx_acme_shared:1M;"
    echo ""
    echo "# Until the first issue succeeds the ACME variables are empty: serve"
    echo "# the static (self-signed) pair meanwhile, so HTTPS never goes down."
    echo "map \$acme_certificate \$bluz_cert {"
    echo "    \"\" /etc/nginx/ssl/cert.pem;"
    echo "    default \$acme_certificate;"
    echo "}"
    echo "map \$acme_certificate_key \$bluz_cert_key {"
    echo "    \"\" /etc/nginx/ssl/key.pem;"
    echo "    default \$acme_certificate_key;"
    echo "}"
} > "$SNIPPETS/acme-http.conf"

{
    echo "acme_certificate bluz ${ACME_DOMAIN};"
    echo "ssl_certificate \$bluz_cert;"
    echo "ssl_certificate_key \$bluz_cert_key;"
    echo "ssl_certificate_cache max=4;"
} > "$SNIPPETS/tls-cert.conf"

echo "40-bluz-acme.sh: ACME on for ${ACME_DOMAIN} via ${ACME_DIRECTORY_URL}"
