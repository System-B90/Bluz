# Bluz

**Bluz** ("Bis Luz") is a Hebrew, right-to-left **scheduling and curriculum-management**
web app for an educational institution. It pairs an interactive class **Calendar** with a
**Gantt-style curriculum builder**, and reads organizational data (students, classes,
rooms, instructors) from an external **Hive** service that also provides SSO.

---

## Quick start

There are two ways in, and they do **not** share commands. Pick the one that
matches what you have.

### From a clone — developing Bluz

Point `bluz.dev` at `127.0.0.3` in your hosts file, then:

```bash
git config core.ignorecase false
pip install -r scripts/requirements.txt
python scripts/setup.py     # interactive: writes .env, SSL certs, registers Hive SSO
python tools.py dev         # backgrounds the dev servers and returns
python tools.py dev status  # what is actually up
```

`tools.py` is the dev-ops CLI for everything else:

```bash
python tools.py dev stop
python tools.py lint --fix
python tools.py test unit
python tools.py ci          # the full CI pipeline locally: lint, unit, Hive, E2E
python tools.py --help
```

Needs Docker, Python 3.11+, Node 24+, and `openssl` on `PATH`.

### From a release bundle — running Bluz

The offline tarball is self-contained and carries its own `install.sh`,
`setup.py` and `requirements.txt` at the bundle root. **These do not exist in
this repository** — do not run them from a clone.

```bash
mkdir bluz && tar -xvf bluz-offline-vX.Y.Z.tar.gz -C bluz && cd bluz
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python setup.py
chmod +x ./install.sh && ./install.sh
```

<details>
<summary>Fresh Ubuntu/Debian server? Install the prerequisites first</summary>

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv python3-pip openssl curl git ca-certificates gnupg

# Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

</details>

### From a terminal — driving Bluz without a checkout

`bluz-cli` talks to a running Bluz instance's API. It installs from the org
pip index, which needs no authentication:

```bash
pip install bluz-cli --index-url https://system-b90.github.io/.github/pypi/
bluz login
bluz --help
```

---

## What it does

- **Calendar / Schedule** — interactive class scheduling with drag-and-drop, rooms,
  instructors, prayer times, offline mode, and real-time multi-user sync.
- **Gantt / Curriculum** — build curriculums from syllabuses → modules → events and
  allocate them across weeks and days with scheduling constraints.
- **Hive SSO** — authentication and shared org data through the external Hive service.

## What it needs

A **Hive** instance (org data + SSO), a **MongoDB** instance (Calendar), and a
**PostgreSQL** instance (Gantt). Docker Compose runs all three locally — `tools.py dev`
and `npm run docker:dev` both handle this for you.

Runtime config lives in the root `.env`, written by `scripts/setup.py`. The full variable
table is in [AGENTS.md §6](AGENTS.md#6-environment--secrets).

---

## Going deeper

**[AGENTS.md](AGENTS.md)** is the reference: layered API design, directory map,
conventions, and every command in one place. Read it before making a change here —
whether you are a person or an agent.

- Stack, architecture and the four API layers → [AGENTS.md](AGENTS.md)
- Full command list → [AGENTS.md §5](AGENTS.md#5-commands-youll-actually-use)
- Contributing and PR conventions → [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)
- Deployment, troubleshooting, backup/restore → [`docs/`](docs/) and the
  [published docs site](https://system-b90.github.io/.github/bluz/)

Most directories carry their own `README.md` with an explicit "should this file live
here?" checklist: [`ui/src/api-client`](ui/src/api-client/README.md) ·
[`ui/src/api-server`](ui/src/api-server/README.md) ·
[`ui/src/api-shared`](ui/src/api-shared/README.md) ·
[`ui/src/components`](ui/src/components/README.md) · [`drizzle`](drizzle/README.md) ·
[`session-server`](session-server/README.md) · [`scripts`](scripts/README.md) ·
[`tests`](tests/README.md)
