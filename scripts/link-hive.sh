#!/bin/bash
# Brings Bluz up against a Hive stack running on the SAME Docker daemon.
#
# Only needed for co-located installs. If Hive runs on another machine, plain
# ./install.sh is enough — set NEXT_PUBLIC_HIVE_URL to Hive's real hostname and
# ordinary DNS handles it.
#
# What this does that `docker compose up` alone cannot: give Bluz's containers a
# working name for Hive. See docker-compose.hive-local.yml for why the alias has
# to live on Hive's nginx container rather than on ours.
set -e

RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; BLUE='\033[1;34m'; NC='\033[0m'

HIVE_HOSTNAME="${HIVE_HOSTNAME:-hive.org}"

if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR] No .env found. Run ./install.sh first.${NC}"
    exit 1
fi

# Locate Hive's network. Compose names it after the directory Hive was brought
# up in, so it is not a fixed string.
if [ -z "$HIVE_NETWORK_NAME" ]; then
    echo -e "${YELLOW}[WAIT] Locating Hive's Docker network...${NC}"
    MATCHES=$(docker network ls --format '{{.Name}}' | grep -E 'hive.*net|net.*hive' || true)
    COUNT=$(echo "$MATCHES" | grep -c . || true)

    if [ "$COUNT" -eq 0 ]; then
        echo -e "${RED}[ERROR] No Hive network found on this Docker daemon.${NC}"
        echo -e "  Is the Hive stack running? Check with: docker compose ls"
        echo -e "  If Hive runs on a DIFFERENT machine, you do not need this script —"
        echo -e "  run ./install.sh and point NEXT_PUBLIC_HIVE_URL at Hive's hostname."
        exit 1
    elif [ "$COUNT" -gt 1 ]; then
        echo -e "${RED}[ERROR] Multiple candidate Hive networks found:${NC}"
        echo "$MATCHES" | sed 's/^/    /'
        echo -e "  Re-run with the right one, e.g.:"
        echo -e "    HIVE_NETWORK_NAME=$(echo "$MATCHES" | head -1) ./link-hive.sh"
        exit 1
    fi
    HIVE_NETWORK_NAME="$MATCHES"
fi
echo -e "${GREEN}[OK] Using Hive network: $HIVE_NETWORK_NAME${NC}"

# Persist it: compose resolves ${HIVE_NETWORK_NAME} on EVERY invocation, not just
# this one. Left unpersisted, the next unrelated compose command (restart,
# update.sh) falls back to the default and aborts before starting anything (#454).
if grep -q '^HIVE_NETWORK_NAME=' .env; then
    sed -i.bak "s|^HIVE_NETWORK_NAME=.*|HIVE_NETWORK_NAME=$HIVE_NETWORK_NAME|" .env && rm -f .env.bak
else
    echo "HIVE_NETWORK_NAME=$HIVE_NETWORK_NAME" >> .env
fi

# Locate Hive's nginx container — the one that must answer to $HIVE_HOSTNAME.
if [ -z "$HIVE_NGINX_CONTAINER" ]; then
    HIVE_NGINX_CONTAINER=$(docker ps --format '{{.Names}}' \
        --filter "network=$HIVE_NETWORK_NAME" | grep -E 'nginx|proxy' | head -1 || true)
fi

if [ -z "$HIVE_NGINX_CONTAINER" ]; then
    echo -e "${RED}[ERROR] Could not find Hive's nginx container on $HIVE_NETWORK_NAME.${NC}"
    echo -e "  Containers currently on that network:"
    docker ps --format '{{.Names}}' --filter "network=$HIVE_NETWORK_NAME" | sed 's/^/    /'
    echo -e "  Re-run naming it explicitly, e.g.:"
    echo -e "    HIVE_NGINX_CONTAINER=hive-nginx ./link-hive.sh"
    exit 1
fi
echo -e "${GREEN}[OK] Using Hive nginx container: $HIVE_NGINX_CONTAINER${NC}"

# Add the alias. Already-connected is the normal case on re-runs, so treat the
# resulting error as success rather than failing the script.
echo -e "\n${YELLOW}[WAIT] Aliasing $HIVE_HOSTNAME onto $HIVE_NGINX_CONTAINER...${NC}"
EXISTING_ALIASES=$(docker inspect "$HIVE_NGINX_CONTAINER" \
    --format "{{range .NetworkSettings.Networks}}{{range .Aliases}}{{println .}}{{end}}{{end}}" 2>/dev/null || true)

if echo "$EXISTING_ALIASES" | grep -qx "$HIVE_HOSTNAME"; then
    echo -e "${GREEN}[OK] Alias already present — nothing to do.${NC}"
else
    # The container is already ON this network, so it must be disconnected before
    # it can be reconnected with the extra alias. Reconnect immediately.
    docker network disconnect "$HIVE_NETWORK_NAME" "$HIVE_NGINX_CONTAINER" 2>/dev/null || true
    docker network connect --alias "$HIVE_HOSTNAME" "$HIVE_NETWORK_NAME" "$HIVE_NGINX_CONTAINER"
    echo -e "${GREEN}[OK] Alias added.${NC}"
fi

echo -e "\n${BLUE}>> Bringing Bluz up with the co-located Hive overlay...${NC}"
export HIVE_NETWORK_NAME
DEPLOY_DIR="$(cd "$(dirname "$0")/../deploy" && pwd)"
# Keep whatever overlays the running stack was started with (e.g. docker:dev's
# dev overlay); dropping them recreates ui in the wrong mode.
RUNNING_FILES="$(docker inspect bluz-ui --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' 2>/dev/null || true)"
[ -n "$RUNNING_FILES" ] || RUNNING_FILES="$DEPLOY_DIR/docker-compose.yml"
case ",$RUNNING_FILES," in
    *docker-compose.hive-local.yml*) ;;
    *) RUNNING_FILES="$RUNNING_FILES,$DEPLOY_DIR/docker-compose.hive-local.yml" ;;
esac
COMPOSE_ARGS=()
IFS=',' read -ra FILES <<< "$RUNNING_FILES"
for f in "${FILES[@]}"; do COMPOSE_ARGS+=(-f "$f"); done
docker compose --env-file "$DEPLOY_DIR/../.env" "${COMPOSE_ARGS[@]}" up -d

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN} Bluz is linked to the local Hive stack. ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "Verify name resolution from inside the ui container:"
echo -e "    docker exec bluz-ui node -e \"require('dns').lookup('$HIVE_HOSTNAME',console.log)\""
