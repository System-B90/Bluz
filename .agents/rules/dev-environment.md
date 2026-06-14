---
trigger: always_on
description: Enforces the Docker-based development workflow and bans running dev servers directly on the host.
---

# Dev Environment Constraints

- **NEVER** propose or run `npm run dev` (or any variant like `next dev`, `npx next dev`, `yarn dev`) directly on the Windows host terminal.
- The Windows host cannot resolve Docker-internal services (`curriculum-db`, `sessions`, `mongodb`, etc.), so host-side dev servers will silently fail or misbehave.
- Always use the Docker-based dev script instead:
  ```powershell
  npm run docker:dev
  ```
- If a dev server must be restarted, restart the relevant Docker container — do not bypass Docker.
