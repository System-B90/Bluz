# Getting Started

This guide walks you through setting up a Bluz development environment.

## Prerequisites

- **Node.js 24** (LTS)
- **Python 3.11+**
- **Docker Desktop** (or Docker Engine + Compose plugin)
- A **Hive** instance for SSO and organizational data

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/system-b90/bluz.git
cd bluz
npm ci
```

### 2. Configure hosts

Route `bluz.dev` to `127.0.0.3` in your hosts file:

=== "Windows (PowerShell — admin)"

    ```powershell
    Add-Content C:\Windows\System32\drivers\etc\hosts "127.0.0.3 bluz.dev"
    ```

=== "Linux / macOS"

    ```bash
    echo '127.0.0.3 bluz.dev' | sudo tee -a /etc/hosts
    ```

### 3. Environment setup

```bash
pip install typer InquirerPy python-dotenv
python setup.py          # Interactive — generates .env with secrets
```

### 4. Run the dev stack

```bash
npm run docker:dev       # Full stack in Docker with hot-reload
```

Alternatively, run Next.js locally with only the proxy in Docker:

```bash
npm run dev
```

## Common Commands

| Command | Description |
|---|---|
| `npm run docker:dev` | Full dev stack (hot-reload) |
| `npm run dev` | Local Next.js + Dockerized proxy |
| `npm run lint` | ESLint (`lint:fix` to autofix) |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:push` | Push schema directly to the DB |
| `npm run db:studio` | Open Drizzle Studio GUI |
| `npm run db:seed` | Seed demo data |
| `npm run test` | Full test pipeline |
| `npm run test:unit` | Vitest unit tests only |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run session:start` | Start the WebSocket session server |

## Environment Variables

Runtime config lives in the root `.env` file. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `POSTGRES_*` | PostgreSQL (Gantt engine) |
| `MONGO_CONNECTION_STRING`, `MONGO_ROOT_*` | MongoDB (Calendar engine) |
| `NEXT_PUBLIC_HIVE_URL`, `HIVE_CLIENT_ID`, `HIVE_CLIENT_SECRET` | Hive microservice + SSO |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | next-auth |
| `JWT_SECRET`, `SYM_ENC_KEY` | Session JWT signing + AES-GCM token encryption |
| `WEBSOCKET_SESSION_SERVER_*` | WebSocket session server host/auth |

!!! warning
    `NEXT_PUBLIC_*` vars are exposed to the browser — never put secrets behind that prefix.

## Dependencies

- A running **Hive** instance (org data + SSO)
- **MongoDB** (Calendar engine) — Docker Compose starts one for you
- **PostgreSQL** (Gantt engine) — Docker Compose starts one for you
