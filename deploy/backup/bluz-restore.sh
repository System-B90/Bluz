#!/usr/bin/env bash
#
# Restores a dump directory produced by bluz-backup.sh into the running stack.
# Destructive: it drops and recreates the target databases.
#
# Usage: bluz-restore.sh <dump-dir> [--yes]
#        bluz-restore.sh <dump-dir> --postgres-only|--mongo-only
# Env:   BLUZ_COMPOSE_FILE    compose file (default alongside this script)
#        BLUZ_ENV_FILE        env file (default: the .env beside the compose file)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${BLUZ_COMPOSE_FILE:-${SCRIPT_DIR}/../docker-compose.yml}"

# Find the .env holding the database credentials.
#
# This script runs from two different layouts: the repository (deploy/backup/,
# with .env at the repo root) and a release bundle (backup/, with .env at the
# bundle root beside docker-compose.yml). A single hardcoded ../../.env is
# correct in the first and points outside the tree in the second, and the old
# "source it if it happens to exist" made that miss surface as an unbound
# POSTGRES_USER halfway through a restore instead of a usable error.
#
# Compose itself requires .env to sit beside the compose file, so that is the
# first candidate and the authoritative one.
# (Duplicated verbatim in bluz-backup.sh: both must stay runnable standalone
# from a release bundle, which ships no shared helper. See #226.)
resolve_env_file() {
    local candidate
    for candidate in \
        "${BLUZ_ENV_FILE:-}" \
        "$(dirname "${COMPOSE_FILE}")/.env" \
        "${SCRIPT_DIR}/../.env" \
        "${SCRIPT_DIR}/../../.env"
    do
        [ -n "${candidate}" ] && [ -f "${candidate}" ] && { echo "${candidate}"; return 0; }
    done
    echo "[bluz-restore] FATAL: no .env found (looked beside ${COMPOSE_FILE}, and above ${SCRIPT_DIR})." >&2
    echo "[bluz-restore]        Point at it explicitly: BLUZ_ENV_FILE=/path/to/.env $0" >&2
    exit 1
}

require_env() {
    local missing=""
    local name
    for name in "$@"; do
        [ -n "${!name:-}" ] || missing="${missing} ${name}"
    done
    [ -z "${missing}" ] || {
        echo "[bluz-restore] FATAL:${missing} not set in ${ENV_FILE}." >&2
        exit 1
    }
}

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

ENV_FILE="$(resolve_env_file)"
# shellcheck disable=SC1090
set -a && . "${ENV_FILE}" && set +a
require_env POSTGRES_USER POSTGRES_DB MONGO_ROOT_USER MONGO_ROOT_PASSWORD

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
