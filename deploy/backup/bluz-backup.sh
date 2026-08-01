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

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${BLUZ_COMPOSE_FILE:-${SCRIPT_DIR}/../docker-compose.yml}"
ENV_FILE="${BLUZ_ENV_FILE:-${SCRIPT_DIR}/../../.env}"
DEST_ROOT="${1:-${BLUZ_BACKUP_DIR:-/var/backups/bluz}}"
KEEP_DAILY="${BLUZ_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BLUZ_KEEP_WEEKLY:-8}"

# shellcheck disable=SC1090
[ -f "${ENV_FILE}" ] && set -a && . "${ENV_FILE}" && set +a

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
