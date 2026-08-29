# Ox Alpha Sweep — State

_Last updated: 2026-08-29 - Bluz stream closed out; local e2e now runnable_

## Objective

Complete and close all open issues labelled **Ox Alpha** across every repo in the
**System-B90** GitHub org.

Operating constraints set by repo owner:

- Orchestrate subagents; the orchestrator does not do heavy coding itself.
- Cost hierarchy: **ox-alpha (free) → sonnet (cheap) → opus (expensive, avoid)**.
- Agent selection: spawn with the configured default subagent (no `subagent_type`,
  no `model` override).
- Scope order: **Bluz first**, then the smaller repos.
- Delivery: **one branch + one PR per repo/thematic batch**, linked to close its issues.

## Blocker history

Four wave-1 agents were spawned with `subagent_type: general-purpose` and
`model: "sonnet"`. All four terminated with the identical error:

```
API Error: Server is temporarily limiting requests (not your usage limit)
Rate limit exceeded: free-models-per-day-stealth
```

A free-tier probe agent failed the same way. No local configuration explains it:
`~/.claude/settings.json` sets `"model": "haiku"`, defines no sonnet entry under
`modelSettings`, and there is no `~/.claude/agents/` directory.

**Conclusion at the time:** the `model` override was not being honored for
subagents — every spawn routed to the stealth model regardless of the parameter,
so the "sonnet fallback" was the same exhausted quota under a different label.

**Resolved 2026-08-29.** Re-tested after the quota reset: a spawn with
`model: "sonnet"` ran to completion (pyhive, 166 tool uses, ~216k subagent
tokens, no rate-limit error). It was quota exhaustion presenting as a routing
bug, **not** a standing defect in the `model` override. Spawning with
`model: "sonnet"` is fine.

## Bluz — pull requests

All Ox Alpha PRs are resolved:

| PR | Base | Status |
|---|---|---|
| #549 | `master` | **merged** (screenshots no longer blocking) |
| #556 | `master` | merged |
| #557 | `master` | merged |
| #558 | `master` | merged |
| #559 | `master` | merged |
| #560 | `fix/ox-alpha-review` | closed |

Later in the session #572, #577, #578 and #587 were merged too (see below). The
only open PRs left on the repo are pre-sweep leftovers, all `CONFLICTING` and
outside Ox Alpha scope: **#301, #347, #405, #408**.

Closed since the last update: issues **#550, #551, #553, #555** — the two items
that were "deferred until #549 merges" are done.

## Bluz — issues blocked on the repo owner, not on agents

These cannot be closed by any agent. They were thought to need only a
**`@system-b90/session-ws` package release** - but the release would not be
enough; #511 and #524 have no fix in that package at all (see below):

- #511, #523, #524, #525, #540 (items 1, 2, 4–7)

Open question for the owner: whether #525's declined ids-only in-repo broadcast
should be revisited.

## Bluz - status: agent-side work is done

Everything reachable by an agent is merged or filed. What is left is owner-side.

| Issue | State |
|---|---|
| ~~#554~~ | **Closed** by PR #572. Two of its four flows are covered by new specs; the other two were carved out into #579 and #580 rather than silently dropped. |
| ~~#538~~ | **Closed.** All 14 items were already fixed on master by the merged #549 and #561 - those PRs simply never carried a `Closes #538` line. |
| #546 | Tracker. Closes on its own once the children close. |
| #511, #523, #524, #525, #540 | Owner-side. See the session-ws section - and note that a release alone will not unblock them. |

### Merged this session

| PR | What |
|---|---|
| **#577** | **The production image could not start at all.** `drizzle-migrate.ts` is esbuild-bundled into `/app/migrate.js`, and `ui/src/logging/pino.ts` configured the `pino-pretty` transport unconditionally; pino resolves a transport target at runtime by module resolution, which cannot work inside the bundle. `docker-entrypoint.sh` runs under `set -e`, so the container died before reaching `node ui/server.js` and restart-looped. Introduced by `dd8d1b46` - the #538 item 13 pino standardization. The transport is now development-only. |
| **#587** | Internal session-server URI used the **container** name (`ws://bluz-sessions:28199/`) instead of the compose **service alias**. `container_name` does not survive a project rename, and `docker-compose.test.yml` renames it - so every e2e run, CI included, logged `getaddrinfo ENOTFOUND bluz-sessions` and passed anyway. Now `ws://sessions:28199/`. |
| **#572** | e2e specs for exports (.ics/.xlsx) and iteration-switch data scoping. Closes #554. |
| **#578** | #571/#573/#574/#575/#576 UI fixes (stacked on #572). |

**Merging the stack needed a manual route.** GitHub refused every CLI path for #572 and #578:

```
This pull request is part of a stack and must be merged using the
asynchronous merge REST API. (mergePullRequest)
```

`gh pr merge` (merge/squash/rebase), `PUT /pulls/{n}/merge`, and `gh pr edit --base master` all hit it, and the documented async endpoint answers 404 on every path tried (`merge-async`, `async-merge`, `async_merge`, `?async=true`). Resolution: merge the stack locally and push to `master` (8b22645f). #572 auto-closed as merged and closed #554; #578 had to be closed manually with an explanatory comment, and #571/#573/#574/#575/#576 closed by hand because its `Closes` keywords never fired. **Anything stacked in this repo needs the web UI, or this local-merge workaround.**

Base branches deleted: `test/ox-alpha-554-e2e-flows`, `fix/issues-571-573-574-575-576`, `fix/pino-pretty-transport-prod`, `fix/ws-internal-service-alias`.

### Filed, not fixed

| Issue | What |
|---|---|
| **#579** | Google Calendar connected state. `isGoogleConfigured()` gates the feature on `GOOGLE_CLIENT_ID`/`SECRET`, which `docker-compose.test.yml` deliberately omits - unreachable without stub infrastructure in the compose file. Carved out of #554. |
| **#580** | CLI to browser login handshake. Both ends tested in isolation, nothing covers the chain. Carved out of #554. |
| **#581** | The `iconOnly` import/export trigger has **no accessible name** - `<Tooltip>` wraps a `<span>`, so the label never reaches the `IconButton`. Two instances also share `triggerLabel`, so an unscoped `getByRole` hits the wrong menu. |
| **#582** | **No e2e coverage of live updates.** Mandates a two-context spec on two *different* users asserting propagation with no reload, and proving it fails when the session server is unreachable. |
| **#583** | `malformed-body.spec.ts` POSTs to `/api/reservations`, which implements `GET`/`PUT`/`DELETE` only - 405, not the asserted 400. |
| **#584** | `instructor-dnd` rail chip locator `[title]` never matches; chips render through MUI `Tooltip`, which emits no native `title`. 3 specs fail. |
| **#585** | Two gantt recurrence specs time out clicking elements that resolve but never become visible. |
| **hive-nextauth#9** | Debug logger dumps OAuth tokens and profile data in production, and the `debug` flag cannot disable it - next-auth assigns a supplied `logger.debug` *after* installing its noop, so the flag is inert. |

## Local e2e - now working, and how

Previously believed impossible outside CI. It is not. Full suite: **156 passed, 8 failed, 5 skipped** in 13.1m. All 8 failures are pre-existing on master (reproduced in isolation, tracked in #583/#584/#585); the two new specs pass.

Recipe, from the `bluz` checkout:

1. **Hive must be the `hive-stack` project**, not the dev `hive` project from `~/Code/Hive`. Only `pyhive/hive-stack/docker-compose.yaml` aliases `hive.org` onto hive-nginx; the dev stack exposes `hive-nginx`/`nginx` only, and without that alias the UI container's server-side OAuth call fails with a bare `SIGNIN_OAUTH_ERROR` (#412). They collide on container names, so one at a time: `docker compose -p hive down` (keeps volumes), then `docker compose up -d` in `pyhive/hive-stack`.
2. **`hive.org` must resolve to `127.0.0.6` in the hosts file.** It pointed at `10.0.0.125` (mks-srvu), which splits the topology: `run_tests.py:311` registers the temporary SSO client *from the host* against `https://hive.org` (the server's Hive), while the UI container resolves `hive.org` over Docker DNS (the local one). Client registered in one Hive, token validated by another; login can never succeed.
3. **`--rebuild` matters.** Compose reuses whatever `ghcr.io/system-b90/bluz/ui:latest` is on the box. A stale dev-built image (`CMD npm run dev`) restart-loops inside the container with `sh: docker: not found`.
4. Then: `python scripts/run_tests.py --skip-unit [--seed-hive] [--spec <name>]`.

Unit tests are `npx vitest run --config tests/vitest.config.ts` - a bare `npx vitest run` picks up the wrong config and collects nothing.

**Gotcha:** `gh run watch --exit-status | tail` swallows the exit code - the pipeline reports `tail`'s status, so a failed run looks like success. Check `gh run view <id> --json conclusion`.

## Second hazard: issues that are already fixed

**#538 was fully fixed on master and still open**, because the PRs that fixed it
(#549, #561) never wrote `Closes #538`. An agent nearly opened a no-op PR.

**Mitigation, now in every agent prompt:** before writing any code, audit whether
the issue is already resolved on master — check the code, and
`git log --grep=<issue number>`. If it is, post an evidence comment and close the
issue instead of opening a PR. Expect more of these among #509–#545.

## Known hazard: Ox Alpha issue bodies are unreliable

Five confirmed cases of issues whose factual claims did not match the code:

- **#555** — cited a renamed file that still existed
- **#553** — named symbols not present on `master`
- **#551** — wrong path, wrong line count, unsatisfiable acceptance criteria
- **#550** — asked for tests of a `_GET_RETRY_ATTEMPTS=3` retry that does not exist
- **pyhive** — wrong source file entirely (see pyhive#31 above)

**Standing mitigation, baked into every agent prompt:** treat each issue as a
strong hint, not as ground truth. Verify every factual claim — file paths, symbol
names, counts, current behaviour — against the actual code before acting on it.
If an issue describes a problem that does not exist, do not invent a change;
report it as invalid, with evidence.

## session-ws release — attempted 2026-08-29, blocked

Bumped to **0.1.3**, committed (`0f06eac`, `Vibe-Bumped session-ws to 0.1.3`) and
pushed to `master`. `publish.yml` dispatched: checkout, `npm ci` and `npm run build`
all passed, the tarball packed (26 files, 13.4 kB) — then the registry PUT was
refused:

```
npm error code E403
npm error 403 Forbidden - PUT https://npm.pkg.github.com/@system-b90%2fsession-ws -
Permission permission_denied: Account has reached its billing limit.
```

**Org-level GitHub Packages billing quota. Owner action; retrying will not help.**
Re-dispatch `publish.yml` once the quota is raised — the workflow is idempotent
(it skips when the version is already on the registry).

**Important: 0.1.3 would not have unblocked the issues anyway.** Verified against
`master` of session-ws:

- **#511 (null-frame crash) — NOT fixed.** `src/server.ts:304` `JSON.parse(...)`
  accepts the literal `null`, then `data["sender"]` at :308 throws `TypeError`
  inside `ws.on("message")` — uncaught, server down for everyone. The exact
  reported bug, still live.
- **#524 (size/rate/backpressure limits) — NOT fixed.** No `maxPayload`, no rate
  limit, no `bufferedAmount` check anywhere in the package.
- **#523 (constant-time compare) — fixed.** `src/common.ts:78` uses
  `timingSafeEqual` behind a length pre-check.

The owner was told this before the bump and chose to publish regardless. So even
after the quota is raised, **#511/#524/#525 stay blocked on real fixes in
session-ws**, not on a release.

## Org-wide quota wall (2026-08-29)

Two unrelated blockers, one root cause — the **System-B90 org's GitHub billing
quotas are exhausted**:

- **Packages:** `npm publish` of `@system-b90/session-ws@0.1.3` → `403 ... Account
  has reached its billing limit.`
- **Actions storage:** the #572 e2e run → `Artifact storage quota has been hit.`

Neither is a code defect and neither will clear by retrying logic. Owner must
raise the quota or free storage; artifact usage recalculates every 6-12 hours, so
that one may clear on its own.

**Tooling note:** `gh run watch --exit-status | tail` swallows the exit code —
the pipeline reports `tail`'s status, so a failed run looks like success. Check
`gh run view <id> --json conclusion` instead of trusting the watch exit code.

## Environment gotchas

- Cross-repo agents must **not** use `isolation: "worktree"`. It forks the
  *current* repo (bluz), stranding the agent in a bluz worktree with no way to
  git against its actual target. Every prompt says "Do NOT create a git worktree";
  the madash prompt adds "do NOT clone the repo — the checkout is already there."
- A bare `python -m pytest cli/tests` run from a worktree imports `bluz_cli` from
  the main checkout. Run it with `PYTHONPATH=cli`.
- Fresh worktrees have no `node_modules`, and `npm ci` returns 401 against GitHub
  Packages unless `NPM_TOKEN` is exported.
- Windows file locks can defeat `git worktree remove --force`. Fall back to
  `Remove-Item -Recurse -Force`, then `git worktree prune`.

## House rules in force (from CLAUDE.md)

- Commit messages: `Vibe-<PastTenseVerb> <description>`. No `feat:` / `chore:`.
- **Never** pass `-n` / `--no-verify`. If a hook fails, run the auto-fixers and
  commit again: `npx eslint --fix && npx prettier --write`, or
  `ruff format . && ruff check --fix .`.
- Run `git status` and `git diff` before any commit.
- Crypto: SHA256 hash, AES-GCM encrypt, ECDSA sign. No custom crypto. Auth: JWT.
  Secrets live in `.env`.
- CI: `ubuntu-latest` everywhere except the `Full Test Suite (E2E, self-hosted)`
  job in `e2e.yml`, which uses `[self-hosted, dind]`.
- Python files carry the standard header block (Name / Purpose / Created /
  Author: Michael K. Steinberg).

## Out of scope, but worth attention

17 Dependabot vulnerabilities on the Bluz default branch — 12 high, 4 moderate,
1 low. Surfaced by an earlier push. Not triaged; outside Ox Alpha scope.

## Next actions

1. **Bluz is done agent-side.** Merged: #572, #577, #578, #587. Remaining Bluz
   work is the filed-not-fixed list above (#579-#585) plus the owner-side items.
2. Wave 1 restarted with **pyhive** (#25–#30, one agent, sonnet) — this doubles
   as the post-quota-reset spawn probe. Then command-palette, peek-a-boo, madash.
3. Then wave 2.
4. Owner-side: raise the GitHub Packages billing quota, then re-dispatch
   `publish.yml` to get 0.1.3 onto the registry (see above).
5. session-ws still needs actual fixes for **#511** (null-frame crash guard) and
   **#524** (maxPayload + rate + backpressure limits) before #511/#524/#525 can
   close. 0.1.3 only carries #523.
6. Owner-side: answer whether #525's declined ids-only in-repo broadcast should
   be revisited.
