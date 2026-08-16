#!/usr/bin/env bash
#
# Bluz online release upgrade.
#
# Upgrades a running Bluz deployment to a new release: back up, pull, roll the
# containers one service at a time, let the ui image run its own migrations,
# then verify. Any failed step stops the upgrade and prints the exact rollback
# command, including the backup taken at the start of this run.
#
# Run it from the directory the release bundle was extracted into — the one
# holding docker-compose.yml and .env.
#
# Usage: ./update.sh [--version <tag>] [--skip-backup] [--yes]
# Env:   BLUZ_COMPOSE_FILE    compose file (default ./docker-compose.yml)
#        BLUZ_COMPOSE_OVERLAY optional extra compose file (e.g. co-located Hive
#                              overlay docker-compose.hive-local.yml)
#        BLUZ_ENV_FILE        env file (default ./.env)
#        BLUZ_BACKUP_SCRIPT   backup script (default: found next to this one)
#        BLUZ_HEALTH_RETRIES  health-check attempts after the roll (default 30)

set -euo pipefail

RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; CYAN='\033[1;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${BLUZ_COMPOSE_FILE:-./docker-compose.yml}"
ENV_FILE="${BLUZ_ENV_FILE:-./.env}"
HEALTH_RETRIES="${BLUZ_HEALTH_RETRIES:-30}"

TARGET_VERSION=""
SKIP_BACKUP=0
ASSUME_YES=0
BACKUP_DIR=""
PREVIOUS_VERSION=""

log()  { echo -e "${CYAN}[bluz-update]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

fail() {
    echo -e "\n${RED}[ERROR] $1${NC}"
    shift
    for line in "$@"; do echo -e "        $line"; done
    exit 1
}

# Every failure past the point of no return routes through here, so the operator
# always leaves with the same two facts: which step broke, and how to get back.
abort_with_rollback() {
    local step="$1"
    echo -e "\n${RED}[ERROR] Upgrade failed during: ${step}${NC}"
    if [ -n "${PREVIOUS_VERSION}" ]; then
        echo -e "        The stack is left as-is for inspection. To roll the images back:"
        echo -e "          1. set BLUZ_VERSION=${PREVIOUS_VERSION} in ${ENV_FILE}"
        echo -e "          2. docker compose -f ${COMPOSE_FILE} ${OVERLAY_ARGS[*]} up -d --wait"
    fi
    if [ -n "${BACKUP_DIR}" ]; then
        echo -e "        A migration may have already changed the databases. To restore this run's backup:"
        echo -e "          ${BACKUP_SCRIPT%/*}/bluz-restore.sh ${BACKUP_DIR}"
    fi
    exit 1
}

while [ $# -gt 0 ]; do
    case "$1" in
        --version) TARGET_VERSION="${2:-}"; shift 2 ;;
        --skip-backup) SKIP_BACKUP=1; shift ;;
        --yes|-y) ASSUME_YES=1; shift ;;
        -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "Unknown argument: $1" "Run ./update.sh --help." ;;
    esac
done

# Co-located Bluz+Hive deployments run with docker-compose.hive-local.yml
# layered on top; without it the rolled ui/sessions/proxy lose their route to
# Hive and sign-in breaks (#412) while every health check still passes.
OVERLAY_ARGS=()
[ -n "${BLUZ_COMPOSE_OVERLAY:-}" ] && OVERLAY_ARGS=(-f "${BLUZ_COMPOSE_OVERLAY}")

compose() { docker compose -f "${COMPOSE_FILE}" "${OVERLAY_ARGS[@]}" --env-file "${ENV_FILE}" "$@"; }

# ---------------------------------------------------------------------------
# Preflight — everything checkable before anything is touched
# ---------------------------------------------------------------------------
command -v docker &> /dev/null \
    || fail "Docker is not installed or not in PATH."

docker info &> /dev/null \
    || fail "Docker is installed but the daemon is not responding." \
            "Start Docker (or 'sudo systemctl start docker') and re-run."

docker compose version &> /dev/null \
    || fail "'docker compose' (v2) is not available."

[ -f "${COMPOSE_FILE}" ] \
    || fail "Compose file not found: ${COMPOSE_FILE}" \
            "Run this from the directory you extracted the release into," \
            "or set BLUZ_COMPOSE_FILE."

[ -f "${ENV_FILE}" ] \
    || fail "Env file not found: ${ENV_FILE}" \
            "An upgrade reuses the existing deployment's .env — this looks like" \
            "a fresh host. Run ./install.sh instead."

# shellcheck disable=SC1090
set -a && . "${ENV_FILE}" && set +a
PREVIOUS_VERSION="${BLUZ_VERSION:-}"
[ -n "${PREVIOUS_VERSION}" ] \
    || fail "BLUZ_VERSION is not set in ${ENV_FILE}." \
            "Compose resolves the image tags from it, so an upgrade has no" \
            "'from' version to roll back to. Set it to the running release first."

if [ -z "${TARGET_VERSION}" ]; then
    [ -f "VERSION" ] \
        || fail "No target version given and no VERSION file in $(pwd)." \
                "Pass it explicitly: ./update.sh --version v1.0.0"
    TARGET_VERSION="$(tr -d '[:space:]' < VERSION)"
fi

[ "${TARGET_VERSION}" != "${PREVIOUS_VERSION}" ] \
    || fail "Already running ${PREVIOUS_VERSION}." \
            "Pass a different --version, or nothing needs doing."

# The stack must actually be running: this script upgrades in place, it does not
# install. A stopped stack should go through install.sh / 'compose up'.
RUNNING_COUNT="$(compose ps --status running --quiet | wc -l | tr -d ' ')"
[ "${RUNNING_COUNT}" -gt 0 ] \
    || fail "No Bluz containers are running." \
            "This script upgrades a live deployment. Start it first:" \
            "  docker compose -f ${COMPOSE_FILE} up -d --wait"

BACKUP_SCRIPT="${BLUZ_BACKUP_SCRIPT:-}"
if [ -z "${BACKUP_SCRIPT}" ]; then
    for candidate in \
        "./backup/bluz-backup.sh" \
        "${SCRIPT_DIR}/backup/bluz-backup.sh" \
        "${SCRIPT_DIR}/../deploy/backup/bluz-backup.sh"
    do
        [ -f "${candidate}" ] && { BACKUP_SCRIPT="${candidate}"; break; }
    done
fi

if [ "${SKIP_BACKUP}" -eq 0 ] && [ -z "${BACKUP_SCRIPT}" ]; then
    fail "Could not find bluz-backup.sh." \
         "An upgrade runs migrations, which are not reversible without a dump." \
         "Point at it with BLUZ_BACKUP_SCRIPT=/path/to/bluz-backup.sh," \
         "or accept the risk explicitly with --skip-backup."
fi

echo
log "upgrade ${PREVIOUS_VERSION} -> ${TARGET_VERSION}"
log "compose file : ${COMPOSE_FILE}"
log "env file     : ${ENV_FILE}"
if [ "${SKIP_BACKUP}" -eq 1 ]; then
    log "backup       : DISABLED (--skip-backup)"
else
    log "backup       : ${BACKUP_SCRIPT}"
fi
echo
if [ "${ASSUME_YES}" -eq 0 ]; then
    read -r -p "Proceed? [y/N] " reply
    case "${reply}" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac
fi

# ---------------------------------------------------------------------------
# 1. Backup — before anything is pulled, so the restore point predates the
#    migrations the new image runs on start.
# ---------------------------------------------------------------------------
if [ "${SKIP_BACKUP}" -eq 1 ]; then
    warn "skipping backup (--skip-backup): a failed migration will not be recoverable"
else
    log "backing up both engines..."
    BLUZ_COMPOSE_FILE="${COMPOSE_FILE}" BLUZ_ENV_FILE="${ENV_FILE}" \
        bash "${BACKUP_SCRIPT}" || abort_with_rollback "backup"
    # The dump directory the backup just wrote is the newest one under either
    # tier; record it so the rollback hint names a real path.
    BACKUP_ROOT="${BLUZ_BACKUP_DIR:-/var/backups/bluz}"
    BACKUP_DIR="$(find "${BACKUP_ROOT}" -mindepth 2 -maxdepth 2 -type d 2>/dev/null | sort | tail -n 1)"
    ok "backup written to ${BACKUP_DIR:-${BACKUP_ROOT}}"
fi

# ---------------------------------------------------------------------------
# 2. Pull — the running containers keep serving while the new images download,
#    which is the bulk of the wall-clock time in an upgrade.
# ---------------------------------------------------------------------------
log "pulling ${TARGET_VERSION} images (containers keep running)..."
BLUZ_VERSION="${TARGET_VERSION}" compose pull \
    || abort_with_rollback "image pull"
ok "images pulled"

# ---------------------------------------------------------------------------
# 3. Roll — service by service, waiting for each to pass its healthcheck before
#    touching the next.
#
#    Compose recreates a container in place, so this is near-zero downtime, not
#    zero: each service is briefly unavailable while its replacement starts.
#    True zero-downtime needs a second stack and a traffic cutover, which the
#    fixed container_name/port bindings in this compose file rule out — see the
#    open question in #438.
#
#    Order matters. ui first: its entrypoint runs the Postgres migrations, and
#    the databases are untouched by a version bump, so nothing else should move
#    until the schema is current and ui is healthy. proxy last, so the public
#    endpoint is the final thing to blink.
# ---------------------------------------------------------------------------
# Persist the new tag first: compose resolves ${BLUZ_VERSION} in image tags from
# the env file, and leaving a stale value behind would silently downgrade the
# stack on the next unrelated `compose up`.
cp "${ENV_FILE}" "${ENV_FILE}.bak-${PREVIOUS_VERSION}"
if grep -q '^BLUZ_VERSION=' "${ENV_FILE}"; then
    sed -i "s|^BLUZ_VERSION=.*|BLUZ_VERSION=${TARGET_VERSION}|" "${ENV_FILE}"
else
    echo "BLUZ_VERSION=${TARGET_VERSION}" >> "${ENV_FILE}"
fi

# The preflight's `set -a && . "${ENV_FILE}"` exported BLUZ_VERSION= into this
# shell, and a real env var outranks --env-file in Compose's ${VAR} substitution
# — so without this the roll below resolves image tags to the OLD version while
# `pull` (which overrides inline) fetched the new one.
export BLUZ_VERSION="${TARGET_VERSION}"

for service in ui sessions proxy; do
    log "rolling ${service}..."
    # --no-deps keeps the databases from being recreated as a side effect.
    compose up -d --wait --no-deps "${service}" \
        || abort_with_rollback "rolling ${service}"
    # Guard against a silent variable-precedence regression: confirm the
    # container that just came up actually carries the target tag.
    running="$(compose ps --format '{{.Image}}' "${service}")"
    case "${running}" in
        *":${TARGET_VERSION}") ;;
        *) abort_with_rollback "post-roll verification: ${service} is running ${running}, expected ${TARGET_VERSION}" ;;
    esac
    ok "${service} is up"
done

# ---------------------------------------------------------------------------
# 4. Verify — health endpoint, then a real read through the app's own DB layer.
#    Postgres migrations already ran inside the ui entrypoint; Mongo has no
#    formal migration mechanism today, so there is nothing to trigger for it.
# ---------------------------------------------------------------------------
log "verifying /api/health..."
attempt=0
until compose exec -T ui node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    &> /dev/null
do
    attempt=$((attempt + 1))
    [ "${attempt}" -lt "${HEALTH_RETRIES}" ] || abort_with_rollback "health check (/api/health)"
    sleep 2
done
ok "/api/health is green"

log "verifying database reachability..."
# /api/health already answers 503 when either engine is down, so this repeats
# the check only to print which one it was — and to catch "degraded" (Hive
# unreachable), which is a 200 the operator should still see named.
compose exec -T ui node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(b=>{console.log(JSON.stringify(b.checks));process.exit(b.status==='unhealthy'?1:0)}).catch(()=>process.exit(1))" \
    || abort_with_rollback "database sanity check"
ok "databases reachable"

echo
ok "Bluz upgraded ${PREVIOUS_VERSION} -> ${TARGET_VERSION}"
echo -e "        previous env file kept at ${ENV_FILE}.bak-${PREVIOUS_VERSION}"
[ -n "${BACKUP_DIR}" ] && echo -e "        pre-upgrade backup: ${BACKUP_DIR}"
exit 0
