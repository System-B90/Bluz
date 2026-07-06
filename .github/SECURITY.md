# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security problems.**

Report privately via
[GitHub Security Advisories](https://github.com/System-B15/Bluz/security/advisories/new)
("Report a vulnerability"). Include reproduction steps, impact, and the affected
surface (Calendar, Gantt, Auth/SSO, session server, CLI, or infra).

You should receive an acknowledgement within a few days. Please allow time for a
fix before any public disclosure.

## Scope Notes

- Auth is Hive SSO (OAuth via next-auth) with JWT sessions and AES-GCM token
  encryption — issues in token handling are high priority.
- Secrets live only in `.env`; anything exposed via `NEXT_PUBLIC_*` reaches the
  browser by design. A secret behind that prefix is itself a vulnerability — report it.
- The WebSocket session server broadcasts edits between clients; auth bypasses
  there are in scope.

## Supported Versions

Only the latest released version (latest `BLUZ_VERSION` tag) receives security fixes.
