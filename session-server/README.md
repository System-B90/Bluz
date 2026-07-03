# Session Server (`session-server`)

## Purpose

This directory houses a standalone, real-time Node.js **WebSocket coordination server**. Its primary responsibility is managing collaborative user sessions, syncing active calendars/Gantt schedules across multiple browser connections, and broadcasting state notifications (such as database event modifications, locking actions, and active synchronization signals) in real time.

---

## Quick Start

```bash
# From the repo root — installs deps and starts the server (tsx)
npm run session:start

# Or from this directory, with file-watching
npm install
npm run dev
```

Configuration (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBSOCKET_SESSION_SERVER_INTERNAL_PORT` | `28199` | Listen port. |
| `WEBSOCKET_SESSION_SERVER_HEARTBEAT_MS` | `30000` | Ping interval; a socket that misses one full interval is terminated. |
| `WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY` | — | Shared secret the Next.js server presents on server-to-server broadcasts. |

The connection registry is **process-local** (in-memory `Map`/`Set`). Running more
than one instance requires a shared broker — see
[docs/performance-and-scaling.md](../docs/performance-and-scaling.md).

---

## Directory Structure

- This is a standalone package containing its own `package.json`, TypeScript build config, and standard socket server script.
- **`session-server.ts`**: The main entry point, housing the WebSocket connection listeners, heartbeat checks, target validation, and message broadcasting loops.
- **`session-common.ts`**: Shared socket event types, client payload models, and contract schemas utilized by the websocket endpoints.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:

- It is a **real-time WebSocket handler**, server broadcast routine, or socket event schema specific to the standalone session synchronization service.
- It configures the socket server deployment (e.g., websocket Dockerfile, websocket dependencies).

### ❌ NO, do NOT put it here if:

- It relates directly to Next.js route API responses, HTML UI views, or Next.js middleware. Place these in **`ui/src/app`** or **`ui/src/components`**.
- It manages persistent database models, relational schema tables, or server database queries. Place these in **`ui/src/api-server`** or **`drizzle/`**.
