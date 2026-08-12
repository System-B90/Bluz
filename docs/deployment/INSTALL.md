# Installing Bluz

This is the README shipped inside the release bundle. It covers a from-scratch
install of `bluz-online-*.tar.gz` or `bluz-offline-*.tar.gz`.

## Quick Start

**Linux / macOS**

```bash
tar -xzf bluz-online-v1.0.0.tar.gz -C bluz && cd bluz
./install.sh
```

**Windows (PowerShell)**

```powershell
tar -xzf bluz-online-v1.0.0.tar.gz -C bluz; cd bluz
.\install.ps1
```

That is the whole install. The script checks your prerequisites, runs the
configuration wizard, pulls (or loads) the images, and starts the stack.

**Running Hive on this same machine?** Use `link-hive.sh` / `link-hive.ps1`
instead — see [Co-located Hive](#co-located-hive) below.

## What you need first

| Requirement | Why | Check |
| --- | --- | --- |
| Docker Engine or Docker Desktop | Runs the stack | `docker info` |
| Docker Compose **v2** | The bundle uses v2 syntax | `docker compose version` |
| Python 3.11+ | Runs the configuration wizard | `python3 --version` |
| `openssl` | Generates self-signed certificates | `openssl version` |
| A Hive server you can reach | Bluz reads its data and uses it for SSO | open its URL in a browser |
| A Hive account that can register SSO applications | The wizard registers Bluz automatically | — |

The online bundle also needs outbound access to `ghcr.io`. The offline bundle
ships every image as a `.tar` under `images/` and needs no registry access.

## What the installer asks you

| Prompt | What to enter |
| --- | --- |
| Domain name | The hostname users will type, e.g. `bluz.school.example`. Becomes `NEXTAUTH_URL` and the certificate CN. |
| Generate self-signed certificates? | `yes` unless you are dropping your own `cert.pem`/`key.pem` into `nginx/ssl/`. |
| Hive URL | Base URL of your Hive server, e.g. `https://hive.example`. |
| Another web server already using 80/443? | `yes` only if this machine already serves those ports. See [Port conflicts](#port-conflicts). |
| Hive username / password | An account allowed to register SSO applications. Used once, not stored. |
| Override built-in Google OAuth? | `no`. Calendar sync works with no setup; this exists only for custom consent-screen branding. |

Everything else — database credentials, JWT and encryption keys — is generated
for you and written to `.env`.

## Layout of an installed bundle

```
bluz/
├── docker-compose.yml              # the stack
├── docker-compose.hive-local.yml   # overlay, co-located Hive only
├── .env                            # written by the wizard — contains secrets
├── install.sh / install.ps1
├── link-hive.sh / link-hive.ps1
├── setup.py, requirements.txt      # the configuration wizard
├── nginx/ssl/                      # cert.pem + key.pem
├── VERSION                         # which release this is
├── images/                         # offline bundle only
└── TROUBLESHOOTING.md
```

**`.env` must stay next to `docker-compose.yml`.** Compose has two separate
`.env` mechanisms — `env_file:` for container environments, and its own `${VAR}`
substitution for image tags — and only the second one is tied to the directory
the compose file sits in. Moving `.env` breaks image tags and database
credentials while appearing to work.

## Topology

**Separate machines (recommended).** Hive on one host, Bluz on another. Set the
Hive URL to Hive's real hostname during setup and ordinary DNS does the rest.
Nothing else is needed.

**Same machine.** Supported, and the path most dev and demo setups take, but it
adds two problems that don't exist otherwise: both stacks want ports 80/443, and
Bluz's containers need a name that resolves to Hive's container. `link-hive.sh`
handles the second; the port question is answered during setup.

### Co-located Hive

```bash
./install.sh      # answer "yes" to the ports question, pick 8080/8443
./link-hive.sh    # aliases hive.org onto Hive's nginx, then brings Bluz up
```

`link-hive.sh` finds Hive's Docker network and its nginx container, adds a
`hive.org` network alias to it, and starts Bluz with the co-located overlay.
Override its guesses with `HIVE_NETWORK_NAME`, `HIVE_NGINX_CONTAINER`, or
`HIVE_HOSTNAME` if your Hive stack is named unusually.

Why an alias rather than `extra_hosts`: `host-gateway` resolves to the host's
gateway address, which does not reach Hive when Hive's nginx is bound to a
specific loopback IP. A container alias on the shared network has no dependency
on host bind addresses or the host's `hosts` file.

### Port conflicts

Bluz publishes on `0.0.0.0:80` and `0.0.0.0:443` by default. If the machine
already serves those ports, set different ones in `.env`:

```ini
BLUZ_HTTP_PORT=8080
BLUZ_HTTPS_PORT=8443
```

Separate ports are the portable answer. Binding a distinct loopback IP
(`BLUZ_BIND_IP`) also works, but on Windows it needs an admin-added loopback
alias *and* the other stack must stop binding `0.0.0.0` — see
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Verifying the install

```bash
docker compose ps                       # every service "running", ui "healthy"
curl -k https://localhost/api/health     # {"status":"ok",...}
```

Then open your domain in a browser and sign in through Hive. If sign-in fails,
check `.env` for `MANUAL_ENTRY_REQUIRED` — that means SSO registration did not
complete. `TROUBLESHOOTING.md` has the manual path.

## Day-two operations

```bash
docker compose ps            # status
docker compose logs -f ui    # follow a service's logs
docker compose down          # stop (data volumes are kept)
docker compose down -v       # stop AND DELETE all data
```

Upgrading: extract the new bundle over a copy of your existing `.env` and
`nginx/ssl/`, then re-run the installer. It skips the wizard when `.env` already
exists and updates `BLUZ_VERSION` from the new `VERSION` file.

Backups: see `docs/backup-and-restore.md` in the repository.
