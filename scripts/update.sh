#!/usr/bin/env bash
#
# Bluz release upgrade — online (pull from GHCR) or offline (from a bundle).
#
# Upgrades a running Bluz deployment in place: back up, get the new images,
# refresh the bundle's own files, roll the containers one service at a time,
# let the ui image run its own migrations, then verify. Any failed step stops
# the upgrade and prints the exact rollback command, including the backup taken
# at the start of this run.
#
# Run it from the directory the release bundle was extracted into — the one
# holding docker-compose.yml and .env.
#
# Usage: ./update.sh [--version <tag>] [--pre-release] [--skip-backup] [--yes]
#        ./update.sh --package <path> [--skip-backup] [--yes]
#
#        Without --version it upgrades to the latest published (non-prerelease)
#        release. Pass --pre-release to opt into the newest release including
#        prereleases (e.g. -rc.N tags).
#
#        --package takes a FULL new offline package — either the downloaded
#        bluz-offline-<tag>.tar.gz or an already-extracted bundle directory —
#        and upgrades entirely from it, with no registry access. The images
#        come from the package's images/*.tar and the deployment's own scripts,
#        compose file and backup helpers are replaced with the package's. The
#        live .env, nginx/ssl/ and every data volume are left untouched.
#
# Env:   BLUZ_RELEASE_REPO    GitHub repo to read releases from
#                              (default System-B90/Bluz)
#        BLUZ_COMPOSE_FILE    compose file (default ./docker-compose.yml)
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
RELEASE_REPO="${BLUZ_RELEASE_REPO:-System-B90/Bluz}"

TARGET_VERSION=""
PRE_RELEASE=0
SKIP_BACKUP=0
ASSUME_YES=0
BACKUP_DIR=""
PREVIOUS_VERSION=""
PACKAGE_ARG=""
PACKAGE_ROOT=""
EXTRACT_DIR=""
BUNDLE_BACKUP_DIR=""

log()  { echo -e "${CYAN}[bluz-update]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

fail() {
    echo -e "\n${RED}[ERROR] $1${NC}"
    shift
    for line in "$@"; do echo -e "        $line"; done
    exit 1
}

# The extracted package is scratch space; it is only ever read from, so there is
# nothing to preserve on the way out.
cleanup() {
    [ -n "${EXTRACT_DIR}" ] && [ -d "${EXTRACT_DIR}" ] && rm -rf "${EXTRACT_DIR}"
    return 0
}
trap cleanup EXIT

# Every failure past the point of no return routes through here, so the operator
# always leaves with the same two facts: which step broke, and how to get back.
abort_with_rollback() {
    local step="$1"
    echo -e "\n${RED}[ERROR] Upgrade failed during: ${step}${NC}"
    if [ -n "${PREVIOUS_VERSION}" ]; then
        echo -e "        The stack is left as-is for inspection. To roll the images back:"
        echo -e "          1. set BLUZ_VERSION=${PREVIOUS_VERSION} in ${ENV_FILE}"
        echo -e "          2. docker compose -f ${COMPOSE_FILE} ${OVERLAY_ARGS[*]} up -d --wait"
        if [ -n "${PACKAGE_ARG}" ]; then
            # An offline roll back needs no registry: `docker load` never removes
            # the tags it replaces, so the previous release's images are still on
            # this host.
            echo -e "        The ${PREVIOUS_VERSION} images are still loaded locally — no download needed."
        fi
    fi
    if [ -n "${BUNDLE_BACKUP_DIR}" ]; then
        echo -e "        The bundle's own files were replaced. The previous copies are in:"
        echo -e "          ${BUNDLE_BACKUP_DIR}"
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
        --package) PACKAGE_ARG="${2:-}"; shift 2 ;;
        --pre-release) PRE_RELEASE=1; shift ;;
        --skip-backup) SKIP_BACKUP=1; shift ;;
        --yes|-y) ASSUME_YES=1; shift ;;
        -h|--help) sed -n '2,34p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "Unknown argument: $1" "Run ./update.sh --help." ;;
    esac
done

if [ -n "${PACKAGE_ARG}" ]; then
    [ -z "${TARGET_VERSION}" ] \
        || fail "--package and --version are mutually exclusive." \
                "An offline package IS the version; it carries exactly one release."
    [ "${PRE_RELEASE}" -eq 0 ] \
        || fail "--package and --pre-release are mutually exclusive." \
                "There is nothing to resolve — the package names its own release."
fi

# Co-located Bluz+Hive deployments run with docker-compose.hive-local.yml
# layered on top; without it the rolled ui/sessions/proxy lose their route to
# Hive and sign-in breaks (#412) while every health check still passes.
#
# link-hive.sh persists HIVE_NETWORK_NAME into .env the first time it links
# this instance to a co-located Hive (#454). Its presence there is what tells
# us the running instance needs the overlay, so default to it automatically
# instead of requiring BLUZ_COMPOSE_OVERLAY to be set by hand every upgrade
# (#547) — without this, update.sh silently drops the overlay and the roll
# leaves Bluz answering 502s until link-hive.sh is re-run.
if [ -z "${BLUZ_COMPOSE_OVERLAY:-}" ] && grep -q '^HIVE_NETWORK_NAME=' "${ENV_FILE}" 2>/dev/null; then
    DEFAULT_OVERLAY="${SCRIPT_DIR}/../docker-compose.hive-local.yml"
    if [ -f "${DEFAULT_OVERLAY}" ]; then
        BLUZ_COMPOSE_OVERLAY="${DEFAULT_OVERLAY}"
        log "co-located Hive detected (HIVE_NETWORK_NAME in ${ENV_FILE}) — using ${DEFAULT_OVERLAY}"
    fi
fi
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

INSTALL_DIR="$(cd "$(dirname "${COMPOSE_FILE}")" && pwd)"

# shellcheck disable=SC1090
set -a && . "${ENV_FILE}" && set +a
PREVIOUS_VERSION="${BLUZ_VERSION:-}"
[ -n "${PREVIOUS_VERSION}" ] \
    || fail "BLUZ_VERSION is not set in ${ENV_FILE}." \
            "Compose resolves the image tags from it, so an upgrade has no" \
            "'from' version to roll back to. Set it to the running release first."

# ---------------------------------------------------------------------------
# Offline package — resolve, unpack and validate it before anything is touched.
#
# A half-valid package is the one failure worth catching early: by the time the
# images are loading, the operator has already accepted a backup and a roll.
# ---------------------------------------------------------------------------
if [ -n "${PACKAGE_ARG}" ]; then
    if [ -d "${PACKAGE_ARG}" ]; then
        PACKAGE_ROOT="$(cd "${PACKAGE_ARG}" && pwd)"
    elif [ -f "${PACKAGE_ARG}" ]; then
        log "extracting ${PACKAGE_ARG}..."
        EXTRACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bluz-package.XXXXXX")"
        tar -xzf "${PACKAGE_ARG}" -C "${EXTRACT_DIR}" \
            || fail "Could not extract ${PACKAGE_ARG}." \
                    "Expected the release's bluz-offline-<tag>.tar.gz."
        PACKAGE_ROOT="${EXTRACT_DIR}"
    else
        fail "Package not found: ${PACKAGE_ARG}" \
             "Pass the bluz-offline-<tag>.tar.gz you downloaded, or the" \
             "directory it extracts into."
    fi

    # The tarball wraps the bundle in one directory (bluz/, or bluz-<tag>/ for
    # packages built before #479's rename), so descend once when the root we
    # landed on is that wrapper rather than the bundle itself.
    if [ ! -f "${PACKAGE_ROOT}/docker-compose.yml" ]; then
        nested="$(find "${PACKAGE_ROOT}" -mindepth 1 -maxdepth 1 -type d)"
        [ "$(echo "${nested}" | wc -l)" -eq 1 ] && [ -n "${nested}" ] \
            && [ -f "${nested}/docker-compose.yml" ] \
            && PACKAGE_ROOT="${nested}"
    fi

    [ -f "${PACKAGE_ROOT}/docker-compose.yml" ] \
        || fail "No docker-compose.yml in the package (${PACKAGE_ROOT})." \
                "That is not a Bluz release bundle."

    ls "${PACKAGE_ROOT}"/images/*.tar &> /dev/null \
        || fail "No images/*.tar in the package (${PACKAGE_ROOT})." \
                "This is the ONLINE bundle — it carries no images and cannot" \
                "upgrade an air-gapped host. Download bluz-offline-<tag>.tar.gz."

    # Which release the package is. Its VERSION file is authoritative; older
    # offline bundles shipped without one, so fall back to the tag recorded in
    # the ui image archive's own manifest (read with tar, not docker — this
    # runs before anything is loaded).
    if [ -f "${PACKAGE_ROOT}/VERSION" ]; then
        TARGET_VERSION="$(tr -d '[:space:]' < "${PACKAGE_ROOT}/VERSION")"
    elif [ -f "${PACKAGE_ROOT}/images/bluz-ui.tar" ]; then
        TARGET_VERSION="$(tar -xOf "${PACKAGE_ROOT}/images/bluz-ui.tar" manifest.json 2>/dev/null \
            | sed -n 's/.*"RepoTags"[^]]*:[^"]*"[^"]*:\([^"]*\)".*/\1/p' | head -n 1)" || TARGET_VERSION=""
    fi

    [ -n "${TARGET_VERSION}" ] \
        || fail "Could not tell which release the package holds." \
                "It has no VERSION file and no readable tag in images/bluz-ui.tar." \
                "Write one and re-run: echo v1.0.0 > ${PACKAGE_ROOT}/VERSION"

    ok "offline package: ${TARGET_VERSION} (${PACKAGE_ROOT})"

# With no --version, upgrade to the newest published release (#479). The
# bundle's own VERSION file is only a fallback: an online deployment upgrades in
# place, so after the first run that file names the release already installed
# and defaulting to it made a bare `./update.sh` a no-op.
elif [ -z "${TARGET_VERSION}" ]; then
    if [ "${PRE_RELEASE}" -eq 1 ]; then
        log "resolving latest release (including prereleases) from ${RELEASE_REPO}..."
        # /releases/latest only ever returns the newest non-prerelease, so an
        # rc.N series (marked prerelease on GitHub) is invisible to it. List
        # all releases instead — GitHub returns them newest-first — and take
        # the first tag, prerelease or not.
        if command -v curl &> /dev/null; then
            TARGET_VERSION="$(curl -fsSL --max-time 15 \
                "https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=1" 2>/dev/null \
                | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
                | head -n 1)" || TARGET_VERSION=""
        fi
    else
        log "resolving latest release from ${RELEASE_REPO}..."
        if command -v curl &> /dev/null; then
            TARGET_VERSION="$(curl -fsSL --max-time 15 \
                "https://api.github.com/repos/${RELEASE_REPO}/releases/latest" 2>/dev/null \
                | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
                | head -n 1)" || TARGET_VERSION=""
        fi
    fi

    if [ -n "${TARGET_VERSION}" ]; then
        ok "latest release is ${TARGET_VERSION}"
    else
        warn "could not reach GitHub — falling back to the bundle's VERSION file"
        [ -f "VERSION" ] \
            || fail "No target version given, GitHub unreachable, and no VERSION file in $(pwd)." \
                    "Pass it explicitly: ./update.sh --version v1.0.0" \
                    "Air-gapped host? Upgrade from a package: ./update.sh --package <path>"
        TARGET_VERSION="$(tr -d '[:space:]' < VERSION)"
    fi
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
log "mode         : $([ -n "${PACKAGE_ARG}" ] && echo "offline (${PACKAGE_ARG})" || echo "online (ghcr.io)")"
log "install dir  : ${INSTALL_DIR}"
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
# 2. Images — the running containers keep serving while the new images arrive,
#    which is the bulk of the wall-clock time in an upgrade.
#
#    Offline: every images/*.tar in the package is loaded, not just the three
#    Bluz ones. Postgres and Mongo are pinned by tag in the compose file and a
#    release may move those pins, in which case the new tag exists nowhere on
#    an air-gapped host but in the package.
# ---------------------------------------------------------------------------
if [ -n "${PACKAGE_ARG}" ]; then
    log "loading ${TARGET_VERSION} images from the package (containers keep running)..."
    for archive in "${PACKAGE_ROOT}"/images/*.tar; do
        log "  $(basename "${archive}")"
        docker load -i "${archive}" > /dev/null \
            || abort_with_rollback "loading $(basename "${archive}")"
    done
    ok "images loaded"

    # Fail here rather than three steps later in the roll: a package whose tars
    # do not carry the tag the compose file will ask for is a broken package,
    # and the symptom without this check is an opaque "manifest not found" on a
    # host that cannot reach a registry to begin with.
    for repo in ui sessions proxy; do
        docker image inspect "ghcr.io/system-b90/bluz/${repo}:${TARGET_VERSION}" &> /dev/null \
            || abort_with_rollback "package verification: ghcr.io/system-b90/bluz/${repo}:${TARGET_VERSION} is not among the loaded images"
    done
    ok "all three Bluz images present at ${TARGET_VERSION}"
else
    log "pulling ${TARGET_VERSION} images (containers keep running)..."
    BLUZ_VERSION="${TARGET_VERSION}" compose pull \
        || abort_with_rollback "image pull"
    ok "images pulled"

    # An online upgrade only ever refreshed the images: setup.py, update.sh
    # itself, install.sh etc. were left at whatever version first installed
    # the deployment, silently drifting forever (setup.py never picking up
    # later fixes). Every release also publishes a "bluz-online-<tag>.tar.gz"
    # asset carrying exactly the same bundle files as the offline package
    # (see release-pipeline.yml's craft-release job) — pull that down and
    # feed it into the same bundle-file refresh below.
    log "fetching ${TARGET_VERSION} bundle files (scripts, compose, etc.)..."
    ONLINE_BUNDLE_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/bluz-online-bundle.XXXXXX.tar.gz")"
    ONLINE_EXTRACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bluz-online-bundle.XXXXXX")"
    EXTRACT_DIR="${ONLINE_EXTRACT_DIR}"
    curl -fsSL --max-time 60 \
        "https://github.com/${RELEASE_REPO}/releases/download/${TARGET_VERSION}/bluz-online-${TARGET_VERSION}.tar.gz" \
        -o "${ONLINE_BUNDLE_ARCHIVE}" \
        || abort_with_rollback "downloading bluz-online-${TARGET_VERSION}.tar.gz"
    tar -xzf "${ONLINE_BUNDLE_ARCHIVE}" -C "${ONLINE_EXTRACT_DIR}" \
        || abort_with_rollback "extracting bluz-online-${TARGET_VERSION}.tar.gz"
    rm -f "${ONLINE_BUNDLE_ARCHIVE}"
    PACKAGE_ROOT="${ONLINE_EXTRACT_DIR}/bluz"
    [ -f "${PACKAGE_ROOT}/setup.py" ] \
        || abort_with_rollback "bluz-online-${TARGET_VERSION}.tar.gz did not contain the expected bundle layout"
fi

# ---------------------------------------------------------------------------
# 3. Bundle files — the deployment's scripts, compose file and backup helpers
#    are replaced with the new release's. For --package this is the package
#    the operator handed us; for a plain online upgrade it is the matching
#    "bluz-online-<tag>.tar.gz" release asset, downloaded just above.
#
#    Everything host-specific is deliberately excluded: .env holds this
#    deployment's secrets, nginx/ssl/ its certificates, and images/ is bulk
#    that has already been loaded into Docker.
# ---------------------------------------------------------------------------
if [ -n "${PACKAGE_ROOT}" ]; then
    BUNDLE_BACKUP_DIR="${INSTALL_DIR}/.bundle-bak-${PREVIOUS_VERSION}"
    log "refreshing bundle files (previous copies -> ${BUNDLE_BACKUP_DIR})..."
    mkdir -p "${BUNDLE_BACKUP_DIR}"

    for relative in \
        docker-compose.yml \
        docker-compose.hive-local.yml \
        install.sh install.ps1 \
        update.sh \
        link-hive.sh link-hive.ps1 \
        setup.py requirements.txt \
        VERSION \
        TROUBLESHOOTING.md INSTALL.md \
        backup/bluz-backup.sh backup/bluz-restore.sh
    do
        [ -f "${PACKAGE_ROOT}/${relative}" ] || continue
        if [ -f "${INSTALL_DIR}/${relative}" ]; then
            mkdir -p "${BUNDLE_BACKUP_DIR}/$(dirname "${relative}")"
            cp -p "${INSTALL_DIR}/${relative}" "${BUNDLE_BACKUP_DIR}/${relative}" \
                || abort_with_rollback "saving previous ${relative}"
        fi
        mkdir -p "${INSTALL_DIR}/$(dirname "${relative}")"
        # The running script is one of the files being replaced. Bash reads the
        # source by offset as it goes, so overwriting update.sh in place would
        # make it resume mid-line in the new file; write a new inode instead.
        cp "${PACKAGE_ROOT}/${relative}" "${INSTALL_DIR}/${relative}.new" \
            && mv -f "${INSTALL_DIR}/${relative}.new" "${INSTALL_DIR}/${relative}" \
            || abort_with_rollback "installing ${relative}"
    done
    chmod +x "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/backup/*.sh 2>/dev/null || true

    # wheels/ is a directory, not a single file, so it does not fit the loop
    # above — swap it wholesale the same way: old copy kept for rollback, new
    # one put in place. Without this the venv's bluz-cli and other vendored
    # packages stay pinned at the previous release forever, since nothing else
    # ever touches wheels/ after install.sh's first run (#672).
    if [ -d "${PACKAGE_ROOT}/wheels" ]; then
        if [ -d "${INSTALL_DIR}/wheels" ]; then
            mv "${INSTALL_DIR}/wheels" "${BUNDLE_BACKUP_DIR}/wheels" \
                || abort_with_rollback "saving previous wheels/"
        fi
        cp -r "${PACKAGE_ROOT}/wheels" "${INSTALL_DIR}/wheels" \
            || abort_with_rollback "installing wheels/"
    fi
    ok "bundle files refreshed"

    # Upgrade the packages the setup wizard's venv already has installed —
    # bluz-cli included — to match wheels/. install.sh only ever runs this on
    # a fresh .env; an in-place upgrade otherwise leaves the venv frozen at
    # whatever version first created it (#672).
    if [ -d "${INSTALL_DIR}/.venv" ] && [ -d "${INSTALL_DIR}/wheels" ]; then
        log "upgrading Python packages in .venv from wheels/..."
        # shellcheck disable=SC1091
        source "${INSTALL_DIR}/.venv/bin/activate"
        pip install --no-index --find-links="${INSTALL_DIR}/wheels" \
            --upgrade -r "${INSTALL_DIR}/requirements.txt" --quiet \
            || { deactivate; abort_with_rollback "upgrading Python packages from wheels/"; }
        # bluz-cli isn't in requirements.txt — it's built by this same release
        # pipeline, not pulled from the org index — so -r above skips it.
        # Install it by name, from the same vendored wheel.
        pip install --no-index --find-links="${INSTALL_DIR}/wheels" \
            --upgrade bluz-cli --quiet \
            || { deactivate; abort_with_rollback "upgrading bluz-cli from wheels/"; }
        deactivate
        ok "Python packages upgraded"
    fi
fi

# ---------------------------------------------------------------------------
# 4. Roll — service by service, waiting for each to pass its healthcheck before
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
# 5. Verify — health endpoint, then a real read through the app's own DB layer.
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
[ -n "${BUNDLE_BACKUP_DIR}" ] && echo -e "        previous bundle files: ${BUNDLE_BACKUP_DIR}"
[ -n "${BACKUP_DIR}" ] && echo -e "        pre-upgrade backup: ${BACKUP_DIR}"
exit 0
