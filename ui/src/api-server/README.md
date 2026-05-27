# API Server (`ui/src/api-server`)

## Purpose

This directory contains the **server-side only** database controllers, service wrappers, and utility modules. It handles all raw database operations (MongoDB query execution, Drizzle PostgreSQL queries), manages active database connections, and integrates with external systems like the Hive service.

Code in this directory is guaranteed to execute exclusively on the server, ensuring credentials and database connections are secure.

---

## Directory Structure

- **`gantt/`**: Server-side database actions and query controllers executing SQL commands via Drizzle ORM against the PostgreSQL database.
- **`hive/`**: Backend integrations and adapters for communicating with the external Hive microservice.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:

- It performs raw **database operations** (MongoDB collections operations, raw SQL or Drizzle DB queries, seed/migration tasks).
- It is a **server-only backend utility** (e.g., websocket broadcast utilities, environment configurations, and server logging setups).
- It is an interface connector or service class that communicates with third-party external server APIs (like the Hive engine).

### ❌ NO, do NOT put it here if:

- It references any client-side browser constructs (`window`, standard React hooks like `useState`, frontend components). Place these in **`ui/src/components`** or **`ui/src/app`**.
- It is a Next.js App Router API endpoint controller (`route.ts`). Place these in **`ui/src/app/api`**.
- It is a shared TypeScript model or enum that is compiled on the client. Place these in **`ui/src/api-shared`**.
