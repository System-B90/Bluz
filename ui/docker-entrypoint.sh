#!/bin/sh
set -e

echo "Applying database migrations..."
npx tsx ./migrate.ts

echo "Starting application..."
exec "$@"