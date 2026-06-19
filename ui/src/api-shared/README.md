# API Shared (`ui/src/api-shared`)

## Purpose

This directory contains code, type definitions, and schema declarations that are **strictly shared** between the client-side (frontend UI) and the server-side Next.js API route handlers. Keeping these modules in `api-shared` ensures contract synchronization, unified validation, and single sources of truth for common domain models across both MongoDB (Calendar engine) and PostgreSQL (Gantt engine).

---

## Directory Structure

- **`types/`**: The central repository for TypeScript interfaces, enums, schemas, and type declarations shared across the frontend and backend (e.g., event, course, SSO, and settings types).
- **`gantt/`**: Shared logic, helper algorithms, and relational validations specifically for the Gantt scheduling engine.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:

- It defines a **data structure, contract, or type interface** that is parsed or sent over the network (used by both client calls and API route handlers).
- It is a **pure utility function or validation checker** (e.g., parsing/validating strings, date/time math, permission checks) that executes identically on both the server and client without side effects.
- It defines a **standardized error type** or HTTP status handler contract that is thrown by the server and read by the client.

### ❌ NO, do NOT put it here if:

- It performs database access, SQL queries, Drizzle schemas, or server-only procedures (MongoDB client connections, environment secret retrievals). Place these in **`ui/src/api-server`**.
- It executes frontend network fetch calls (e.g., frontend endpoint wrappers, Axios setups, client-side React Query/swr hooks). Place these in **`ui/src/api-client`**.
- It contains React components, UI hooks, page contexts, or CSS/styling definitions. Place these in **`ui/src/components`** or **`ui/src/app`**.
