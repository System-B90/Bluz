# Bluz — Installation Troubleshooting

Every entry here is a failure seen on a real from-scratch install. Each gives
the root cause, not just the fix.

---

## `env file ../.env not found`

**Cause:** an old (≤ v1.0.0-rc.1) bundle shipped the development compose file,
whose paths are relative to a `deploy/` subdirectory that the bundle does not
have.

**Fix:** upgrade to a bundle that ships `docker-compose.yml` with root-relative
paths. To verify yours is correct:

```bash
grep -nE '(\.\./|build:)' docker-compose.yml   # should print nothing
```

If you must stay on the old bundle: create a `deploy/` directory, move
`docker-compose.yml` into it, copy `.env` into *both* that directory and the
bundle root, and run compose from `deploy/`.

---

## Images pull as `:latest`, or Postgres starts with blank credentials

**Cause:** `.env` is not in the same directory as `docker-compose.yml`.

Compose loads `.env` two independent ways:

| Mechanism | Reads from | Feeds |
| --- | --- | --- |
| `env_file:` | the path written in the compose file | container environments |
| `${VAR}` substitution | the **project directory** (next to the compose file) | image tags, inline `environment:` blocks |

Satisfying only the first leaves `${BLUZ_VERSION}` and `${POSTGRES_USER}`
resolving to empty strings — so images fall back to `latest` (a tag Bluz never
publishes) and Postgres initialises with no credentials.

**Fix:** keep `.env` next to `docker-compose.yml`. Confirm what Compose actually
resolved:

```bash
docker compose config | grep -E 'image:|POSTGRES_USER'
```

Current bundles fail loudly instead — `${BLUZ_VERSION:?...}` aborts with the
variable name rather than substituting a blank.

---

## `Bind for 127.0.0.3:80 failed: port is already allocated`

Two different problems produce this one message.

**1. The bind IP is not usable.** On Windows, `127.0.0.2` and above are not
bindable until added to the loopback interface. As Administrator, once:

```powershell
netsh interface ipv4 add address "Loopback Pseudo-Interface 1" 127.0.0.3 255.0.0.0
```

**2. Another service holds the port on `0.0.0.0`.** This is the one that
surprises people. Docker Desktop on Windows reserves a published port **by port
number**, not per-IP the way Linux's iptables NAT does. So if a local Hive stack
publishes `80:80` (which means `0.0.0.0:80`), Bluz cannot take `127.0.0.3:80`
even though the addresses differ.

**Fix — recommended.** Give Bluz its own ports and skip the whole problem:

```ini
# .env
BLUZ_HTTP_PORT=8080
BLUZ_HTTPS_PORT=8443
```

**Fix — distinct IPs.** Works, but *both* stacks must bind specifically. Leaving
either on `0.0.0.0` re-creates the conflict:

```yaml
# Hive's compose             # Bluz's .env
ports:                       BLUZ_BIND_IP=127.0.0.3
  - "127.0.0.1:80:80"
  - "127.0.0.1:443:443"
```

Find what currently holds the port:

```bash
ss -ltnp "sport = :80"                          # Linux
Get-NetTCPConnection -State Listen -LocalPort 80  # Windows
```

---

## Sign-in fails with `SIGNIN_OAUTH_ERROR` and nothing else in the logs

**Cause:** the `ui` container cannot resolve your Hive hostname. `ui` makes
*server-side* calls to `NEXT_PUBLIC_HIVE_URL` during NextAuth's token/profile
exchange, so it needs working name resolution of its own — the browser reaching
Hive proves nothing about what `ui` can reach.

On a co-located install the specific trap is: Docker's embedded DNS doesn't know
`hive.org`, falls through to the host's `hosts` file, finds `127.0.0.1 hive.org`
— and inside `ui`'s network namespace, `127.0.0.1` is `ui` itself. It tries to
talk OAuth to itself.

**Diagnose:**

```bash
docker exec bluz-ui node -e "require('dns').lookup('hive.org',console.log)"
docker exec bluz-ui node -e "fetch('https://hive.org/api/core/version/').then(r=>console.log(r.status)).catch(console.error)"
```

**Fix — Hive on another machine:** set `NEXT_PUBLIC_HIVE_URL` to a hostname that
resolves from inside containers (a real DNS name, not a hosts-file entry).

**Fix — Hive on this machine:** run `./link-hive.sh` (or `.\link-hive.ps1`). It
puts a `hive.org` alias on Hive's own nginx container inside the shared Docker
network and brings Bluz up joined to that network. Manually:

```bash
docker network disconnect hive-stack_hive-net hive-nginx
docker network connect --alias hive.org hive-stack_hive-net hive-nginx
docker compose -f docker-compose.yml -f docker-compose.hive-local.yml up -d
```

`extra_hosts: hive.org:host-gateway` is **not** a reliable fix: `host-gateway`
is the host's gateway address, which does not reach a Hive nginx bound to a
specific loopback IP.

---

## SSO registration fails / `.env` contains `MANUAL_ENTRY_REQUIRED`

**Cause (fixed in current bundles):** the wizard's non-browser fallback posted an
OAuth2 resource-owner-password grant to `/api/core/sso/token/`. Hive's default
SSO client only permits the authorization-code grant, so that request returned
`unauthorized_client` for every credential, and setup fell through to
placeholders without saying so clearly.

Current bundles authenticate via `/api/core/token/` instead — the same endpoint
pyhive's CLI uses — try the browser and password flows in turn, and offer a
retry before writing placeholders.

**Fix if you are stuck with placeholders:** re-run the wizard (`python3
setup.py`), or register by hand:

```bash
pip install PyHiveLMS --index-url https://raw.githubusercontent.com/System-B90/.github/main/pypi/
pyhive -u <admin-user> -p <password> register Bluz --hive-url https://hive.example
```

Copy the returned values into `.env` and restart:

```ini
HIVE_CLIENT_ID=<client_id>
HIVE_CLIENT_SECRET=<client_secret>
```

```bash
docker compose up -d --force-recreate ui
```

The redirect URI Bluz registers is `${NEXTAUTH_URL}/api/auth/callback/hive`. If
you registered by hand, make sure it matches exactly — a trailing-slash mismatch
fails the same opaque way.

---

## `ui` never becomes healthy

Its healthcheck probes `/api/health`, which returns 503 while a dependency is
down — so an unhealthy `ui` usually means a database problem, not a UI problem.

```bash
docker compose ps
docker compose logs curriculum-db mongodb
docker compose logs ui | tail -50
```

Common causes:

- **Postgres restarting with an auth error.** Credentials in `.env` changed
  after the data volume was initialised. The volume keeps the *original*
  password. Either restore the old value or `docker compose down -v` (**deletes
  all data**) and re-run.
- **`start_period` not elapsed.** `ui` is given 60s before failures count.
- **Not enough memory.** Postgres plus MongoDB plus Next.js needs ~4 GB. On
  Docker Desktop, raise the VM memory limit in Settings → Resources.

---

## `network hive-stack_hive-net declared as external, but could not be found`

**Cause:** you are using the co-located overlay without a running Hive stack, or
Hive's network is named something else — Compose names networks after the
directory the stack was brought up in.

```bash
docker network ls | grep hive
```

**Fix:** pass the real name, or drop the overlay entirely if Hive is on another
machine (the base `docker-compose.yml` does not reference Hive's network at all):

```bash
HIVE_NETWORK_NAME=hive_hive-net ./link-hive.sh
```

---

## Browser warns the certificate is untrusted

Expected: the wizard generates a self-signed certificate. Either accept it, or
drop a real `cert.pem` and `key.pem` into `nginx/ssl/` and restart the proxy:

```bash
docker compose restart proxy
```

The certificate CN must match your domain. Check with:

```bash
openssl x509 -noout -subject -in nginx/ssl/cert.pem
```

---

## Collecting diagnostics

If you need to open an issue, this captures the useful state — review it for
secrets before sharing, as `docker compose config` prints resolved values:

```bash
docker compose ps > diag.txt
docker compose config >> diag.txt
docker compose logs --tail=200 >> diag.txt
docker version >> diag.txt
```
