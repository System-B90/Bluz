#!/usr/bin/env bash
#
# Restores a dump directory produced by bluz-backup.sh into the running stack.
# Destructive: it drops and recreates the target databases.
#
# Usage: bluz-restore.sh <dump-dir> [--yes]
#        bluz-restore.sh <dump-dir> --postgres-only|--mongo-only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${BLUZ_COMPOSE_FILE:-${SCRIPT_DIR}/../docker-compose.yml}"
ENV_FILE="${BLUZ_ENV_FILE:-${SCRIPT_DIR}/../../.env}"

DUMP_DIR="${1:-}"
shift || true

ASSUME_YES=0
DO_PG=1
DO_MONGO=1
for arg in "$@"; do
    case "${arg}" in
    --yes | -y) ASSUME_YES=1 ;;
    --postgres-only) DO_MONGO=0 ;;
    --mongo-only) DO_PG=0 ;;
    *)
        echo "unknown argument: ${arg}" >&2
        exit 2
        ;;
    esac
done

[ -d "${DUMP_DIR}" ] || {
    echo "usage: $0 <dump-dir> [--yes] [--postgres-only|--mongo-only]" >&2
    exit 2
}

# shellcheck disable=SC1090
[ -f "${ENV_FILE}" ] && set -a && . "${ENV_FILE}" && set +a

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }
log() { printf '[bluz-restore] %s\n' "$*"; }

if [ -f "${DUMP_DIR}/SHA256SUMS" ]; then
    log "verifying checksums"
    (cd "${DUMP_DIR}" && grep -v 'SHA256SUMS$' SHA256SUMS | sha256sum -c -)
fi

if [ "${ASSUME_YES}" -ne 1 ]; then
    echo "This DESTROYS the current contents of the target databases."
    read -r -p "Type RESTORE to continue: " confirm
    [ "${confirm}" = "RESTORE" ] || { echo "aborted"; exit 1; }
fi

# The app holds open connections and would both block the DROP and write to a
# half-restored database.
log "stopping app containers"
compose stop ui sessions || true

if [ "${DO_PG}" -eq 1 ]; then
    log "restoring postgres"
    compose exec -T curriculum-db \
        psql -U "${POSTGRES_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\" WITH (FORCE);" \
        -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"
    compose exec -T curriculum-db \
        pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner \
        < "${DUMP_DIR}/postgres.dump"
fi

if [ "${DO_MONGO}" -eq 1 ]; then
    log "restoring mongodb"
    compose exec -T mongodb \
        mongorestore --username "${MONGO_ROOT_USER}" --password "${MONGO_ROOT_PASSWORD}" \
        --authenticationDatabase admin --archive --gzip --drop \
        < "${DUMP_DIR}/mongodb.archive.gz"
fi

log "starting app containers"
compose start sessions ui || true

log "done"
