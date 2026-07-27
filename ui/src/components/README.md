# Components (`ui/src/components`)

## Purpose

This directory is the foundational core of the Bluz user interface. It contains all reusable React components, custom hooks, providers, and layout systems. All visual presentation logic, MUI customization, state management interfaces, and client-side scheduler interactions reside here.

---

## Directory Structure

- **`app-commands/`**: Bluz's contributions to the command palette — the Hebrew copy, and the hooks each surface uses to register its own commands. See its [README](app-commands/README.md).
- **`auth/`**: Components, forms, and contexts related to authentication flows, SSO interactions, and user session validation.
- **`base/`**: Core application frameworks and wrappers (e.g., custom sidebars, page wrappers, offline-state providers, and standard layout grids).
- **`command-palette/`**: The generic, VSCode-style command palette. Self-contained and staged for extraction into a shared library — it must not import anything outside itself. See its [README](command-palette/README.md).
- **`gantt/`**: All timeline, curriculum mapping, constraint allocation, and curriculum view components specific to the relational PostgreSQL-backed Gantt scheduler.
- **`header/`**: Navigation bars, user settings menus, title bars, and header modules.
- **`schedule/`**: The complete MongoDB-backed interactive Calendar schedule engine. Includes calendar grid view, drag-and-drop handlers, popup dialogue modals, and schedule event-specific components.
- **`settings-dialog/`**: Application and user configuration dialog systems.
- **`theme/`**: The global theme styling rules, dark/light mode palettes, and MUI component style overrides.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:

- It is a **React Component (`.tsx` or `.jsx`)** that manages or renders part of the visual layout or user interface.
- It is a **React Provider or Context** that supplies UI-state or frontend capabilities (e.g., websocket context, scheduling hooks, offline indicators).
- It contains **pure styling, MUI theme palettes, or layout variables** that dictate the visual appearance of the application.

### ❌ NO, do NOT put it here if:

- It performs raw database calls or runs backend route logic. Place these in **`ui/src/api-server`** (for database) or **`ui/src/app`** (for route handlers).
- It executes frontend client HTTP network fetches (`fetch`, axios queries). Place these in **`ui/src/api-client`**.
- It defines structural TypeScript contracts, interfaces, or Hebrew enums shared directly with the server. Place these in **`ui/src/api-shared`**.
