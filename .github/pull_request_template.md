<!--
Title: short + imperative, matching the repo's commit style, e.g.
"Vibe-Fixed recurrence satisfaction rule" or "Vibe-Implemented Gantt day views".
Branch naming: feature/<feature-name> or hotfix/<bug-name>.
-->

## Summary

<!-- What does this PR do, and why? 1-3 sentences. Link the motivating context. -->

## Related Issues

<!-- e.g. Closes #123, Relates to #45. Delete if none. -->

## Surface Affected

<!-- Check all that apply. -->

- [ ] 📅 Schedule / Calendar (MongoDB engine)
- [ ] 📊 Gantt / Curriculum (PostgreSQL / Drizzle engine)
- [ ] 🔌 API layers (`api-client` / `app/api` / `api-server` / `api-shared`)
- [ ] 🔐 Auth / Hive SSO
- [ ] 🔄 WebSocket session server
- [ ] 🐍 `bluz` CLI
- [ ] 🐳 Infra (Docker, Nginx, CI, scripts)
- [ ] 📚 Docs only

## Changes

<!-- Bullet the notable changes. Reviewers read this before the diff. -->

-

## Screenshots / Recordings

<!--
Required for UI changes. The app is Hebrew RTL (dir="rtl") — capture in RTL,
and include light + dark theme if the change touches theming.
Delete this section for non-UI changes.
-->

## How Was This Tested?

<!-- Check what you ran; describe anything manual. -->

- [ ] `npm run test:unit` (Vitest)
- [ ] `npm run test:e2e` (Playwright)
- [ ] Manual verification via `npm run docker:dev` / `npm run dev`
- [ ] Not tested (explain why):

## Checklist

- [ ] `npm run lint` passes.
- [ ] Code lands in the correct API layer (see each layer's `README.md` checklist); no browser imports in `api-server`, no side effects in `api-shared`.
- [ ] CSS uses logical properties (`marginInlineStart`, not `marginLeft`) — RTL-first.
- [ ] Gantt schema changes include a generated migration (`npm run db:generate`) — no hand-edited `drizzle/*.sql`.
- [ ] Correct DB engine for the surface: Mongo for Calendar, Postgres for Gantt.
- [ ] No secrets committed; nothing sensitive behind `NEXT_PUBLIC_*`.
- [ ] Hebrew UI strings kept intact (not translated to English).
- [ ] Behavior changes to tested components come with updated tests.
- [ ] `AGENTS.md` / per-directory `README.md` updated if files moved between layers.
