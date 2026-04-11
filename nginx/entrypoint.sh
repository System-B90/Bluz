#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"
mkdir -p "$SSL_DIR"

# Generate a self-signed certificate if one does not exist
if [ ! -f "$SSL_DIR/server.key" ] || [ ! -f "$SSL_DIR/server.crt" ]; then
    echo "No SSL certificates found. Generating self-signed certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/server.key" \
        -out "$SSL_DIR/server.crt" \
        -subj "/C=US/ST=State/L=City/O=System-B15/CN=localhost"
    echo "Certificates generated successfully."
fi

# Execute the default NGINX command
exec "$@"