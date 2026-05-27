# API Client (`ui/src/api-client`)

## Purpose
This directory houses the **client-side API wrappers** and query helpers. These modules provide React components with simple, async functional wrappers to perform HTTP operations (GET, POST, DELETE, PUT) against the backend Next.js `/api/...` route endpoints. They handle standard request structuring, serialization, headers injection, and JSON response parsing.

---

## Directory Structure

*   **`gantt/`**: Client fetch modules and endpoints dedicated to the Gantt scheduler (e.g., fetching curriculums, updating relational constraints, allocating module slots).

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:
*   It is a **frontend request function** (utilizing `fetch()`, Axios, or client HTTP protocols) that reaches out to a Next.js server `/api` path.
*   It is a frontend helper that formats query strings or payload requests specifically for API consumption.

### ❌ NO, do NOT put it here if:
*   It performs server-side database access (MongoDB connections, SQL commands, Drizzle queries). Place these in **`ui/src/api-server`**.
*   It is a Next.js backend route endpoint logic handler (`route.ts`). Place these in **`ui/src/app/api`**.
*   It contains UI components, styles, or state contexts. Place these in **`ui/src/components`**.
