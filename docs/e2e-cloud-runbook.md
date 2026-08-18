# Running E2E in a cloud agent session

How to get the Playwright suite running inside a **Claude Code cloud session**
(`Bis90-GH-Bluz` and friends) — a fresh Linux container with no Docker daemon
running, no images, and no Hive stack.

This is the cloud counterpart to the `dev-environment` skill, which assumes a
Windows workstation with `bluz.dev` already in `hosts` and images already built.
Nothing here changes how E2E works; it is the same
`scripts/run_tests.py --seed-hive --skip-unit` entry point CI uses, with the
container-specific setup spelled out.

## Quick Start

Copy-paste, in order, from the repo root. Budget ~25 minutes of setup before the
suite starts; the whole thing is slower than the 8-vCPU CI box.

```bash
# 0. One-time per session: bypass the agent HTTPS proxy for local hostnames.
#    Without this every request to hive.org / bluz.dev returns 403 from the proxy.
export NO_PROXY="hive.org,bluz.dev,127.0.0.3,127.0.0.6,$NO_PROXY"
export no_proxy="$NO_PROXY"

# 1. Start the Docker daemon (the socket exists, nothing is listening on it).
(nohup dockerd > /tmp/dockerd.log 2>&1 &) ; sleep 8 ; docker info > /dev/null && echo "docker up"

# 2. Hostname aliases. Hive's nginx binds 127.0.0.6, Bluz's proxy binds 127.0.0.3,
#    so they can share :80/:443 without colliding.
printf "127.0.0.6 hive.org\n127.0.0.3 bluz.dev\n" >> /etc/hosts

# 3. Hive stack source (compose + pinned image SHA) from the pyhive repo.
git clone --depth 1 https://github.com/System-B90/pyhive /workspace/pyhive
cp -a /workspace/pyhive/hive-stack/. /workspace/hive/     # directory MUST be named "hive"

# 4. Pull the 14 prebuilt Hive images from GHCR and retag them to hive/*.
echo "$NPM_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
cd /workspace/hive && TAG=$(cat HIVE_SHA)
for img in $(docker compose -f docker-compose.yaml config --images | grep '^hive/' | sort -u); do
    name="${img#hive/}"; name="${name%%:*}"
    docker pull "ghcr.io/system-b90/hive/${name}:${TAG}" && docker tag "ghcr.io/system-b90/hive/${name}:${TAG}" "$img"
done

# 5. Boot and initialize Hive (see "Hive bring-up" below for why in this order).
printf 'HIVE_CORE_WORKERS=2\nHIVE_CORE_THREADS=2\nHIVE_NGINX_WORKERS=1\n' > .env.override
mkdir -p ./db && chown -R 999:999 ./db
docker compose -f docker-compose.yaml up -d database redis
# …wait for Postgres healthy (loop below), then:
docker compose -f docker-compose.yaml up -d
c="docker compose -f docker-compose.yaml"
$c exec -T core python manage.py migrate
$c exec -T core python manage.py collectstatic --noinput
$c exec -T database sh /update.sh
$c exec -T core python manage.py service_accounts
$c exec -T core python manage.py load_tags
$c exec -T -e DJANGO_SUPERUSER_USERNAME=admin -e DJANGO_SUPERUSER_PASSWORD=Password1 \
    -e DJANGO_SUPERUSER_EMAIL=admin@hive.org core python manage.py createsuperuser --noinput
$c exec -T core python manage.py load_programs

# 6. Python deps for the test orchestrator.
cd /home/user/Bluz
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install -q -r scripts/requirements.txt

# 7. Point Playwright at the Chromium this image actually ships (see below),
#    then run the suite.
export CI=true PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)
/tmp/venv/bin/python scripts/run_tests.py --seed-hive --skip-unit
```

## Why each step exists

### The agent HTTPS proxy (step 0)

Cloud sessions route outbound HTTPS through a proxy whose `NO_PROXY` covers
`127.0.0.1` but **not** the `hive.org` / `bluz.dev` hostnames. Any client that
resolves those names — `pyhive`, Playwright, the seeding scripts — gets a bare
`403 Forbidden` from the proxy rather than a connection error, which reads like
an auth failure and sends you hunting in the wrong place.

Export `NO_PROXY`/`no_proxy` (both spellings; different libraries read
different ones) before anything touches those hosts. Never disable TLS
verification or unset `HTTPS_PROXY` to work around it.

### Docker daemon (step 1)

`/var/run/docker.sock` exists and `docker` is installed, but no daemon is
running — `docker info` reports "Cannot connect to the Docker daemon". Start
`dockerd` yourself. The cgroup v1 deprecation warning it prints is harmless.

### Hostname aliases (step 2)

Two nginx instances share the box. Hive's publishes on `127.0.0.6`, Bluz's test
proxy on `127.0.0.3`. Both need :80/:443, hence the separate loopback aliases.
Bluz's `ui` container deliberately has **no** `extra_hosts` entry for `hive.org`
— it joins Hive's Docker network and resolves the container alias over Docker
DNS, because a `host-gateway` route cannot reach a loopback-bound port (#412).

### Hive images from GHCR, not source (steps 3-4)

Hive's source is `hivelms/Hive`, a different org that a Bluz session cannot
clone. Use the **registry** path that
`System-B90/.github/actions/setup-hive` implements:

- Compose file, `.env` and the pinned `HIVE_SHA` come from `System-B90/pyhive`
  under `hive-stack/`.
- Runtime images are published to `ghcr.io/system-b90/hive/<service>:<HIVE_SHA>`
  and retagged locally to the `hive/<service>` names the compose expects.
- `docker login ghcr.io` accepts the session's `NPM_TOKEN` (the same PAT that
  `.npmrc` uses for the private `@system-b90/*` packages — it carries
  `read:packages`).

**The stack directory must be named `hive`.** Compose derives its project name
from the directory, and the network name follows: `hive/` gives
`hive_hive-net`, which is what Bluz's `.env` `HIVE_NETWORK_NAME` points at.
Leaving it as `hive-stack/` yields `hive-stack_hive-net` and Bluz's `ui`
container fails to attach.

### Hive bring-up order (step 5)

- **`.env.override`** caps gunicorn at 2 workers × 2 threads. Hive's committed
  `.env` asks for 10 × 8, which starves the Bluz build on a small container.
- **`chown 999:999 ./db`** — Postgres 18 refuses a data directory it does not
  own, and Docker creates a missing bind-mount source as root.
- **Datastores first, then the rest.** Bring up `database` and `redis` alone and
  wait for Postgres yourself. Compose's `depends_on` budget is fixed and expires
  on a slow box, aborting the whole bring-up with "dependency failed to start …
  is unhealthy" for a database that is merely slow.

Wait for Postgres like this — the `-h 127.0.0.1` and the two-consecutive-passes
rule both matter, because the entrypoint runs `initdb` against a temporary
socket-only server that answers the bare healthcheck and then disappears:

```bash
cid=$(docker compose -f docker-compose.yaml ps -q database); stable=0
for i in $(seq 1 90); do
    s=$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo unknown)
    if [ "$s" = healthy ] && docker exec "$cid" pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
        stable=$((stable+1)); [ $stable -ge 2 ] && { echo "postgres ready"; break; }
    else stable=0; fi
    sleep 5
done
```

If `docker compose up -d` still fails on a dependency, just run it again — the
containers it already created survive, and the retry usually succeeds.

Verify before moving on; a broken Hive shows up much later as an opaque
Playwright auth failure:

```bash
/tmp/venv/bin/python -c "
from pyhive import HiveClient
with HiveClient('admin','Password1','https://hive.org',verify=False,timeout=60) as c:
    print('Hive OK', c.get_hive_version())"
```

### The test run (steps 6-7)

`scripts/run_tests.py` is the only entry point worth using. It allocates free
ports, generates every `TEST_*` variable the compose override needs, registers
an OAuth client in Hive, builds and starts the Bluz test stack, seeds both
databases, and then invokes Playwright. Calling `npm run test:e2e` directly
skips all of that — and `npm run docker:test` is Windows-only (`set VAR=…&&`).

**Chromium version skew — this will bite you.** Chromium is preinstalled under
`/opt/pw-browsers` and `playwright install` is blocked, but the browser build
the image ships is pinned independently of the `@playwright/test` version in
`package.json`. When they disagree, all 157 tests fail identically at launch:

```
Error: browserType.launch: Executable doesn't exist at
/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
```

(Playwright 1.62 wanted build 1234; the image had 1194.) The playwright config
honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for exactly this — set it to the
binary that is present and the run proceeds. Do **not** run
`playwright install`, and do not pin the dependency down to match the image:

```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)
```

Use the full `chromium-*/chrome-linux/chrome` binary rather than
`chromium_headless_shell-*`; headless works fine through it.

Useful flags: `--spec gantt` / `--grep <pattern>` to narrow the run,
`--seed-only` to stop after the stack is up and seeded, `--rebuild` to force
fresh images.

## Prerequisites already present in a cloud session

| Thing | Status |
| --- | --- |
| `NPM_TOKEN` | Set — used for both `npm ci` and `docker login ghcr.io` |
| `.env` | Present at the repo root, already CI-shaped |
| `nginx/ssl/{cert,key}.pem` | Present (self-signed) |
| Chromium for Playwright | `/opt/pw-browsers`, with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — **build may not match `@playwright/test`; see below** |
| Docker + compose | Installed; **daemon is not running** |

## Resource notes

A full Hive stack plus the Bluz test images needs roughly **20 GB of disk** and
comfortably more than 8 GB of RAM. Writable disk in a cloud session is a fixed
allowance, so `df` "Avail" at 0 with low "Used" means the allowance is spent,
not that the disk is full — delete build artifacts and stale images to recover.

Expect the suite to run considerably slower than on CI's 8-vCPU box. Treat a
first-run failure as suspect until you have matched it against the actual
failure signature; do not assume the code is at fault before checking whether
the stack came up cleanly.

## Do not commit the seed snapshot

`--seed-hive` rewrites the tracked file `scripts/demo/hive_data.json`. It is a
generated export of whatever Hive instance you just seeded, so it carries that
instance's auto-increment IDs — a throwaway Hive in a fresh container produces
different ids for the same users. It is tracked so a run *without*
`--seed-hive` can reuse it, but your local churn is not a change anyone wants:

```bash
git checkout -- scripts/demo/hive_data.json
```

Revert it before committing anything else from an E2E session. A stop hook that
nags about uncommitted changes will point at this file — it is the one thing
here that should be discarded rather than committed.

## Teardown

```bash
docker compose --env-file .env \
    -f deploy/docker-compose.yml -f deploy/docker-compose.test.yml down -v
cd /workspace/hive && docker compose -f docker-compose.yaml down -v --remove-orphans
```

Hive's services are `restart: always`, so they outlive the test run and keep
holding ports and memory. Tear them down explicitly when finished.
