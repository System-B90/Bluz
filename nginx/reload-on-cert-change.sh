#!/bin/sh
# Name: reload-on-cert-change.sh
# Purpose: Reloads nginx when /etc/nginx/ssl/cert.pem changes, so a certificate
#          renewed by the ACME sidecar (#803) is served without a restart.
# Created: 2026-10-02
# Author: Michael K. Steinberg
#
# Installed into /docker-entrypoint.d/, which the nginx image runs before it
# starts; the watcher is backgrounded so startup continues. Cheap no-op when
# the certificate never changes (self-signed installs).
set -eu

CERT=/etc/nginx/ssl/cert.pem
INTERVAL="${CERT_WATCH_SECONDS:-300}"

(
    last=$(sha256sum "$CERT" 2>/dev/null | cut -d' ' -f1 || true)
    while sleep "$INTERVAL"; do
        now=$(sha256sum "$CERT" 2>/dev/null | cut -d' ' -f1 || true)
        if [ -n "$now" ] && [ "$now" != "$last" ]; then
            if nginx -t -q; then
                nginx -s reload && echo "cert-watch: certificate changed, nginx reloaded"
                last=$now
            fi
        fi
    done
) &
