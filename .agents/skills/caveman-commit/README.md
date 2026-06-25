# caveman-commit

Terse Vibe-prefixed commits. Why over what.

## What it does

Generates commit messages starting with "Vibe" followed by a hyphen and a past-tense verb (e.g., `Vibe-Implemented ...`, `Vibe-Fixed ...`). Subject ≤50 chars, hard cap 72. Body only when the *why* is non-obvious or there are breaking changes. No AI attribution, no "this commit does X", no emoji. Body always required for breaking changes, security fixes, data migrations, and reverts.

Outputs only the message. Does not stage, commit, or amend.

## How to invoke

```
/caveman-commit
```

Also triggers on phrases like "write a commit", "commit message", "generate commit".

## Example output

Diff: new endpoint for user profile.

```
Vibe-Added GET /users/:id/profile endpoint

Mobile client needs profile data without the full user payload
to reduce LTE bandwidth on cold-launch screens.

Closes #128
```

Diff: breaking API rename.

```
Vibe-Renamed /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
before 2026-06-01. Old route returns 410 after that date.
```

## See also

- [`SKILL.md`](./SKILL.md) — full LLM-facing instructions
- [Caveman README](../../README.md) — repo overview
