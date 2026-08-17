# Performance & Scaling

How the Bluz runtime is tuned, which knobs exist, and the path to horizontal scale.

## Runtime performance defaults

### PostgreSQL (Gantt engine)

`ui/src/api-server/gantt/index.ts` owns the single `postgres-js` pool per process:

- Pooled connections with an env-configurable ceiling (`POSTGRES_POOL_MAX`, default 10).
- Idle connections close after `POSTGRES_IDLE_TIMEOUT_S` (default 30s).
- The pool is cached on `globalThis`, so Next.js dev hot-reload reuses it instead of
  leaking a new pool per module re-evaluation.
- `POSTGRES_PREPARE=false` disables named prepared statements for
  transaction-mode poolers (PgBouncer, RDS Proxy).

### MongoDB (Calendar engine)

`ui/src/api-server/mongo-db-controller.ts` shares one `MongoClient` across all
iteration databases:

- Pool sizing via `MONGO_MAX_POOL_SIZE` (default 50) / `MONGO_MIN_POOL_SIZE` (default 0).
- The client is cached on `globalThis` for dev hot-reload.
- Indexes on hot query paths are created lazily in the background, once per
  database per process (`createIndex` is idempotent, so racing instances are safe):
    - `events { id: 1 }` — every event read/update filters on the client-generated id.
    - `events { startTime: 1, endTime: 1 }` — calendar date-window queries.
    - `calendarSnapshots { createdAt: -1 }` — newest-first snapshot listing.
    - `bluz_meta.iterations { id: 1 }`, `{ isCurrent: 1 }` — iteration registry lookups.

### Real-time broadcast path

- The Next.js server keeps **one persistent WebSocket** to the session server
  (`ui/src/api-server/web-socket-utils.ts`). Broadcasts cost a single `send()`
  instead of a TCP + WebSocket handshake per message. Messages sent while
  (re)connecting are queued (bounded at 1000) and flushed on open.
- The session server (`session-server/session-server.ts`) tracks connections in
  `Map`/`Set` registries, serializes each broadcast payload once, and detects dead
  sockets with protocol-level ping/pong heartbeats (`WEBSOCKET_SESSION_SERVER_HEARTBEAT_MS`,
  default 30s) instead of the old hourly mark-and-sweep GC.

## Tuning knobs

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_POOL_MAX` | `10` | Max Postgres connections per app instance. |
| `POSTGRES_IDLE_TIMEOUT_S` | `30` | Seconds before an idle Postgres connection closes. |
| `POSTGRES_CONNECT_TIMEOUT_S` | `10` | Postgres connect timeout. |
| `POSTGRES_PREPARE` | `true` | Set `false` behind a transaction-mode pooler. |
| `MONGO_MAX_POOL_SIZE` | `50` | Max Mongo connections per app instance. |
| `MONGO_MIN_POOL_SIZE` | `0` | Warm Mongo connections kept open. |
| `MONGO_MAX_IDLE_TIME_MS` | `60000` | Idle time before a pooled Mongo connection closes. |
| `WEBSOCKET_SESSION_SERVER_INTERNAL_PORT` | `28199` | Session server listen port. |
| `WEBSOCKET_SESSION_SERVER_HEARTBEAT_MS` | `30000` | Heartbeat interval; sockets missing one full interval are terminated. |

## Horizontal scaling playbook

The app tier is *almost* stateless. Scale in this order:

1. **Run N Next.js replicas** behind the existing Nginx proxy. Watch two pieces of
   in-process state:
    - *Current-iteration cache*: each process resolves the current iteration from
      the `bluz_meta` registry on cold start, but an in-process switch is not seen
      by sibling replicas until they restart. Move the switch signal to the DB
      probe (or a pub/sub invalidation) before scaling writes on iterations.
    - *Connection budget*: total DB connections = replicas × pool max. Size
      `POSTGRES_POOL_MAX`/`MONGO_MAX_POOL_SIZE` against the servers' limits.
2. **Put PgBouncer in front of Postgres** (transaction mode, `POSTGRES_PREPARE=false`)
   once replicas × pool max approaches `max_connections`.
3. **Session server**: a single instance handles thousands of sockets — it is I/O
   bound and does no per-message work beyond fan-out. To go multi-instance the
   in-memory registry must move behind a broker: each instance subscribes to a
   Redis pub/sub channel, publishes inbound broadcasts to it, and fans out to its
   local sockets. Sticky sessions at the proxy are *not* required once the broker
   carries every broadcast.
4. **MongoDB / Postgres**: replica set (Mongo) and read replicas (Postgres) are the
   last step; current data volumes do not justify them.

## Should Schedule and Gantt be separate microservices?

There are 3 viable solutions for splitting the Schedule and Gantt surfaces.

| Solution | Pros | Cons |
| --- | --- | --- |
| **1. Keep the modular monolith** (current, recommended) | Zero new network hops; one deploy; the four-layer split + separate databases already isolate the domains; free in-process type sharing via `api-shared`. | Both surfaces scale together; a heavy Gantt export can steal CPU from calendar requests. |
| **2. Extract Gantt only** | Gantt already has hard seams (own Postgres DB, generated CRUD routes, no Mongo access); isolates CPU-heavy Excel export; independent deploy cadence. | New service boundary to operate (auth propagation, versioned contracts, tracing); `api-shared` types must become a published package; +1–5ms per internal hop. |
| **3. Full split (Schedule svc + Gantt svc + gateway)** | Maximum independent scaling; smallest blast radius per deploy. | Highest operational cost (three deployables + gateway); SSO/session handling duplicated; cross-surface features (iterations touch both) need distributed coordination. |

**Expected performance gain from splitting today: negligible.** Route handlers are
thin; virtually all request latency is database and Hive I/O, which a service split
does not change — it only adds serialization and a network hop (~1–5ms per internal
call). The one real win is *isolation*: Excel export (`exceljs`) is the only
CPU-bound workload, and it can be isolated far more cheaply by moving export into a
worker thread or a small job runner than by extracting a service.

Revisit the split when any of these triggers hit:

- Gantt and Schedule need materially different replica counts.
- Separate teams own the two surfaces and deploys block each other.
- Export/report generation grows into a sustained CPU workload.

Until then, solution 1 with the playbook above is the faster, cheaper path.
