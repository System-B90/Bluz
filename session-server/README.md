# Session Server (`session-server`)

## Purpose
This directory houses a standalone, real-time Node.js **WebSocket coordination server**. Its primary responsibility is managing collaborative user sessions, syncing active calendars/Gantt schedules across multiple browser connections, and broadcasting state notifications (such as database event modifications, locking actions, and active synchronization signals) in real time.

---

## Directory Structure

*   This is a standalone package containing its own `package.json`, TypeScript build config, and standard socket server script.
*   **`session-server.ts`**: The main entry point, housing the WebSocket connection listeners, heartbeat checks, target validation, and message broadcasting loops.
*   **`session-common.ts`**: Shared socket event types, client payload models, and contract schemas utilized by the websocket endpoints.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:
*   It is a **real-time WebSocket handler**, server broadcast routine, or socket event schema specific to the standalone session synchronization service.
*   It configures the socket server deployment (e.g., websocket Dockerfile, websocket dependencies).

### ❌ NO, do NOT put it here if:
*   It relates directly to Next.js route API responses, HTML UI views, or Next.js middleware. Place these in **`ui/src/app`** or **`ui/src/components`**.
*   It manages persistent database models, relational schema tables, or server database queries. Place these in **`ui/src/api-server`** or **`drizzle/`**.
