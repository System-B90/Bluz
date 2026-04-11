#!/bin/sh
set -e

echo "Applying database migrations..."
./node_modules/.bin/tsx ./migrate.ts

echo "Starting application..."
exec "$@"