#!/usr/bin/env bash
#
# Dumps both Bluz stateful engines to a versioned directory and prunes old
# dumps. Run from the host (not inside a container) so the dumps survive
# `docker compose down -v` and any loss of the app host's volumes.
#
# Usage: bluz-backup.sh [destination-dir]
# Env:   BLUZ_BACKUP_DIR      destination root (default /var/backups/bluz)
#        BLUZ_KEEP_DAILY      daily dumps to retain (default 14)
#        BLUZ_KEEP_WEEKLY     weekly dumps to retain (default 8)
#        BLUZ_COMPOSE_FILE    compose file (default alongside this script)
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
# POSTGRES_USER halfway through a dump instead of a usable error.
#
# Compose itself requires .env to sit beside the compose file, so that is the
# first candidate and the authoritative one.
# (Duplicated verbatim in bluz-restore.sh: both must stay runnable standalone
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
    echo "[bluz-backup] FATAL: no .env found (looked beside ${COMPOSE_FILE}, and above ${SCRIPT_DIR})." >&2
    echo "[bluz-backup]        Point at it explicitly: BLUZ_ENV_FILE=/path/to/.env $0" >&2
    exit 1
}

require_env() {
    local missing=""
    local name
    for name in "$@"; do
        [ -n "${!name:-}" ] || missing="${missing} ${name}"
    done
    [ -z "${missing}" ] || {
        echo "[bluz-backup] FATAL:${missing} not set in ${ENV_FILE}." >&2
        exit 1
    }
}

DEST_ROOT="${1:-${BLUZ_BACKUP_DIR:-/var/backups/bluz}}"
KEEP_DAILY="${BLUZ_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BLUZ_KEEP_WEEKLY:-8}"

ENV_FILE="$(resolve_env_file)"
# shellcheck disable=SC1090
set -a && . "${ENV_FILE}" && set +a
require_env POSTGRES_USER POSTGRES_DB MONGO_ROOT_USER MONGO_ROOT_PASSWORD

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
# Sunday dumps go to the weekly tier, everything else to the daily tier. Two
# tiers with separate counts is what makes "14 days plus 8 weeks" expressible
# without tracking dump ages individually.
TIER="daily"
[ "$(date -u +%u)" = "7" ] && TIER="weekly"

OUT_DIR="${DEST_ROOT}/${TIER}/${STAMP}"
mkdir -p "${OUT_DIR}"

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }

log() { printf '[bluz-backup] %s\n' "$*"; }

log "dumping postgres -> ${OUT_DIR}/postgres.dump"
# Custom format (-Fc): compressed, and restorable selectively with pg_restore.
compose exec -T curriculum-db \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
    > "${OUT_DIR}/postgres.dump"

log "dumping mongodb -> ${OUT_DIR}/mongodb.archive.gz"
compose exec -T mongodb \
    mongodump --username "${MONGO_ROOT_USER}" --password "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin --archive --gzip \
    > "${OUT_DIR}/mongodb.archive.gz"

# A zero-byte dump means the pipe failed while the exit status still looked
# clean; catch it here rather than at restore time.
for f in "${OUT_DIR}/postgres.dump" "${OUT_DIR}/mongodb.archive.gz"; do
    [ -s "$f" ] || { log "FATAL: $f is empty"; exit 1; }
done

sha256sum "${OUT_DIR}"/* > "${OUT_DIR}/SHA256SUMS"
log "wrote $(du -sh "${OUT_DIR}" | cut -f1) to ${OUT_DIR}"

prune() {
    local tier="$1" keep="$2" dir="${DEST_ROOT}/$1"
    [ -d "${dir}" ] || return 0
    # Timestamps sort lexicographically, so "all but the newest N" is a tail.
    find "${dir}" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n "+$((keep + 1))" |
        while read -r old; do
            log "pruning ${tier} ${old}"
            rm -rf "${old}"
        done
}

prune daily "${KEEP_DAILY}"
prune weekly "${KEEP_WEEKLY}"

log "done"
