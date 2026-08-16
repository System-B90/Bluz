#!/bin/bash
set -e

RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; BLUE='\033[1;34m'; CYAN='\033[1;36m'; NC='\033[0m'

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}      Bluz Linux Bootstrapper          ${NC}"
echo -e "${CYAN}=========================================${NC}"

fail() {
    echo -e "\n${RED}[ERROR] $1${NC}"
    shift
    for line in "$@"; do echo -e "        $line"; done
    exit 1
}

# ---------------------------------------------------------------------------
# Preflight
#
# Everything below is checked BEFORE compose is invoked. Each of these used to
# surface as an opaque Docker error several minutes into an install, with
# nothing in the message pointing at the actual cause (#412).
# ---------------------------------------------------------------------------

command -v docker &> /dev/null \
    || fail "Docker is not installed or not in PATH." \
            "Install Docker Engine or Docker Desktop, then re-run this script."

docker info &> /dev/null \
    || fail "Docker is installed but the daemon is not responding." \
            "Start Docker Desktop (or 'sudo systemctl start docker') and re-run."

docker compose version &> /dev/null \
    || fail "'docker compose' (v2) is not available." \
            "This bundle needs Compose v2. The standalone 'docker-compose' v1" \
            "binary is not supported — upgrade Docker, or install the compose plugin."

if ! command -v python3 &> /dev/null || ! command -v pip3 &> /dev/null; then
    fail "python3 and pip3 are required to run the setup wizard." \
         "On Debian/Ubuntu: sudo apt install python3 python3-pip python3-venv"
fi

[ -f "docker-compose.yml" ] \
    || fail "docker-compose.yml not found in $(pwd)." \
            "Run this script from the directory you extracted the release into."

# ---------------------------------------------------------------------------
# Environment configuration (setup.py)
# ---------------------------------------------------------------------------
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}[WAIT] Initializing environment configuration wizard...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    python3 setup.py
    deactivate
    [ -f ".env" ] || fail "The setup wizard did not produce a .env file." \
                          "Re-run it directly to see the failure: python3 setup.py"
    echo -e "${GREEN}[OK] Environment configured.${NC}"
else
    echo -e "\n${GREEN}[OK] Existing .env found. Skipping configuration wizard.${NC}"
fi

# .env must sit beside docker-compose.yml. Compose has TWO separate .env
# mechanisms — `env_file:` (what containers get) and its own ${VAR} substitution
# engine (what image tags and inline environment: blocks get) — and only the
# latter is tied to the project directory. Getting this half-right is what made
# images resolve to a never-published `latest` and Postgres start with blank
# credentials in rc.1.
if [ ! -f "./.env" ]; then
    fail ".env is not in the same directory as docker-compose.yml." \
         "Compose resolves \${VAR} in image tags from a .env beside the compose file." \
         "Move it here: mv <path>/.env ./.env"
fi

# ---------------------------------------------------------------------------
# Port availability
#
# Two distinct failure modes hide behind Docker's "port is already allocated":
# something else already holds the port, or (on Windows) the requested bind IP
# is not a valid loopback alias. Catch the first here with a real explanation.
# ---------------------------------------------------------------------------
BIND_IP=$(grep -E '^BLUZ_BIND_IP=' .env | cut -d= -f2- || true)
HTTP_PORT=$(grep -E '^BLUZ_HTTP_PORT=' .env | cut -d= -f2- || true)
HTTPS_PORT=$(grep -E '^BLUZ_HTTPS_PORT=' .env | cut -d= -f2- || true)
BIND_IP="${BIND_IP:-0.0.0.0}"; HTTP_PORT="${HTTP_PORT:-80}"; HTTPS_PORT="${HTTPS_PORT:-443}"

port_in_use() {
    if command -v ss &> /dev/null; then
        ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN
    elif command -v netstat &> /dev/null; then
        netstat -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]"
    else
        return 1  # no tool to check with; let compose be the judge
    fi
}

for PORT in "$HTTP_PORT" "$HTTPS_PORT"; do
    if port_in_use "$PORT"; then
        echo -e "\n${YELLOW}[WARN] Something is already listening on port $PORT.${NC}"
        echo -e "        If that is another stack (a local Hive, say), Bluz's proxy will"
        echo -e "        fail to start. Two ways out:"
        echo -e "          1. Give Bluz different ports — set BLUZ_HTTP_PORT / BLUZ_HTTPS_PORT in .env"
        echo -e "          2. Bind both stacks to distinct IPs — set BLUZ_BIND_IP in .env AND"
        echo -e "             make the other stack bind a specific IP too (a service left on"
        echo -e "             0.0.0.0 reserves the port for every address, not just its own)."
    fi
done

# ---------------------------------------------------------------------------
# Image resolution & versioning (offline vs online)
# ---------------------------------------------------------------------------
if [ -f "VERSION" ]; then
    DETECTED_TAG=$(cat VERSION)
else
    DETECTED_TAG=""
fi
IS_OFFLINE=false

echo -e "\n${YELLOW}[WAIT] Resolving Docker images...${NC}"
if ls images/*.tar 1> /dev/null 2>&1; then
    IS_OFFLINE=true
    echo -e "${BLUE}>> Offline bundle detected. Loading local image archives...${NC}"

    for img in images/*.tar; do
        echo "   Loading $img..."
        LOAD_OUT=$(docker load -i "$img")

        # Extract the version tag from the docker load output (e.g., "Loaded image: ...:v1.0.0")
        if [[ "$LOAD_OUT" =~ :(v[0-9]+\.[0-9]+\.[0-9]+[^[:space:]]*)$ ]]; then
            DETECTED_TAG="${BASH_REMATCH[1]}"
        fi
    done
    echo -e "${GREEN}[OK] Successfully loaded offline images (Tag: $DETECTED_TAG).${NC}"
else
    echo -e "${BLUE}>> No local images found. Assuming Online Mode.${NC}"
fi

# `latest` is never published — only tagged v* builds push images — so falling
# back to it produces a manifest-not-found several steps later instead of here.
[ -n "$DETECTED_TAG" ] \
    || fail "Could not determine which Bluz version to run." \
            "The bundle should contain a VERSION file (online) or images/*.tar (offline)." \
            "Neither was found, and there is no usable default: the 'latest' tag is never published." \
            "Set it by hand if you know the version: echo v1.0.0 > VERSION"

# Inject version tag into .env
if grep -q "^BLUZ_VERSION=" .env; then
    sed -i.bak "s/^BLUZ_VERSION=.*/BLUZ_VERSION=$DETECTED_TAG/" .env && rm -f .env.bak
else
    echo "BLUZ_VERSION=$DETECTED_TAG" >> .env
fi

# Persist HIVE_NETWORK_NAME if the operator set it (co-located installs). Without
# this it evaporates after this run and the NEXT compose command — a restart, an
# upgrade — falls back to the default, which does not exist. See #454.
if [ -n "${HIVE_NETWORK_NAME:-}" ]; then
    if grep -q "^HIVE_NETWORK_NAME=" .env; then
        sed -i.bak "s|^HIVE_NETWORK_NAME=.*|HIVE_NETWORK_NAME=${HIVE_NETWORK_NAME}|" .env && rm -f .env.bak
    else
        echo "HIVE_NETWORK_NAME=${HIVE_NETWORK_NAME}" >> .env
    fi
fi

# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------
echo -e "\n${YELLOW}[WAIT] Validating compose configuration...${NC}"
docker compose config --quiet \
    || fail "docker-compose.yml did not validate against your .env." \
            "The error above names the missing or malformed variable."

if [ "$IS_OFFLINE" = false ]; then
    echo -e "\n${YELLOW}[WAIT] Pulling containers from GHCR ($DETECTED_TAG)...${NC}"
    docker compose pull \
        || fail "Failed to pull images for version $DETECTED_TAG." \
                "If this is a private build, log in first: docker login ghcr.io"
fi

echo -e "\n${YELLOW}[WAIT] Starting Bluz services...${NC}"
docker compose up -d

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN} 🎉 Bluz Installation Complete! 🎉 ${NC}"
echo -e "${GREEN}=========================================${NC}"
NEXTAUTH_URL=$(grep -E '^NEXTAUTH_URL=' .env | cut -d= -f2- || true)
[ -n "$NEXTAUTH_URL" ] && echo -e "Bluz should now be reachable at: ${CYAN}$NEXTAUTH_URL${NC}"

# SSO registration is the one setup step with a manual fallback, and silently
# leaving the placeholder in place means sign-in is simply broken post-install.
if grep -q "MANUAL_ENTRY_REQUIRED" .env 2>/dev/null; then
    echo -e "\n${RED}[ACTION REQUIRED] Hive SSO is NOT configured — sign-in will fail.${NC}"
    echo -e "  .env still contains MANUAL_ENTRY_REQUIRED placeholders."
    echo -e "  Re-run the wizard to retry registration:  python3 setup.py"
    echo -e "  See TROUBLESHOOTING.md (\"SSO registration\") for the manual path."
fi

echo -e "\nTo stop the system, run: docker compose down"
echo -e "Running Hive on this same machine? Use ./link-hive.sh instead of this script."
