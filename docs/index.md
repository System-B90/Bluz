---
hide:
  - navigation
---

# Bluz Developer Documentation

Welcome to the **Bluz** developer docs. Bluz ("Bis Luz") is a Hebrew, right-to-left
scheduling and curriculum-management web application built for an educational institution.

## What's Inside

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Getting Started**

    ---

    Environment setup, dev commands, and your first run.

    [:octicons-arrow-right-24: Quick Start](getting-started.md)

-   :material-layers-triple:{ .lg .middle } **Architecture**

    ---

    The four-layer API design, directory map, database split, and conventions.

    [:octicons-arrow-right-24: Architecture Guide](architecture.md)

-   :material-code-braces:{ .lg .middle } **API Reference**

    ---

    Auto-generated TypeScript API docs from JSDoc comments across `api-shared`,
    `api-server`, and `api-client`.

    [:octicons-arrow-right-24: API Reference](api/)

-   :material-console:{ .lg .middle } **CLI Reference**

    ---

    Complete command reference for the `bluz` Python CLI tool.

    [:octicons-arrow-right-24: CLI Reference](cli/index.md)

</div>

## Product Surfaces

| Surface | What it does | Database |
|---|---|---|
| **Schedule / Calendar** | Interactive calendar for class events, prayer times, rooms, instructors. Drag-and-drop, offline mode, real-time sync. | MongoDB |
| **Gantt / Curriculum** | Builds curriculums from syllabuses → modules → events, allocates them across weeks/days with constraints. | PostgreSQL (Drizzle ORM) |

Both surfaces read shared organizational data (students, classes, rooms, users, subjects)
from an external **Hive** microservice, which also serves as the SSO identity provider.

## Tech Stack

Next.js 16 (App Router, React 19) · TypeScript · MUI v7 + Tailwind v4 (RTL) ·
Drizzle ORM / PostgreSQL · MongoDB · next-auth · WebSocket session server ·
Docker Compose · Playwright + Vitest.
