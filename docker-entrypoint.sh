#!/bin/sh

# Exit on error
set -e

echo "Pushing database schema..."
# We use npx to ensure the local version is used
npx drizzle-kit push

echo "Starting application..."
exec "$@"