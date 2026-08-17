# App Router (`ui/src/app`)

## Purpose

This directory is the core of the Next.js routing structure. It utilizes the App Router paradigm to organize all application pages (user-facing views) and server-side backend API endpoints (HTTP route handlers). It acts as the gateway connecting request paths to their corresponding layouts, views, or server-side logic.

---

## Directory Structure

- **`(themed)/`**: Next.js route group containing user-facing pages and layouts (e.g., scheduling grids, login views, and Gantt timeline pages). Grouping under `(themed)` allows shared styling and header configurations.
- **`api/`**: The complete backend server layer of the Bluz application. Contains all API route handlers (`route.ts`) executing DB queries (MongoDB/PostgreSQL) and responding to REST requests from the frontend client.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:

- It is a Next.js routing primitive: a page (`page.tsx`), layout (`layout.tsx`), error page (`error.tsx`), or middleware wrapper.
- It is an HTTP backend API handler file (`route.ts`, or `route.tsx` only when it actually renders JSX) responsible for processing REST endpoints (e.g. `/api/...`).

### ❌ NO, do NOT put it here if:

- It is a reusable UI component or frontend context. Place these in **`ui/src/components`**.
- It is a client-side API endpoint request wrapper (using `fetch`). Place these in **`ui/src/api-client`**.
- It is a raw server database driver, SQL schema, or database connection utility. Place these in **`ui/src/api-server`** or **`drizzle/`**.
