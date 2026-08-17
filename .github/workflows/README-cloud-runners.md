# Cloud-runner mirrors

Two extra workflow files can run all non-E2E CI on GitHub-hosted runners:

| Self-hosted (original) | Cloud mirror |
| --- | --- |
| `release-pipeline.yml` — *Build and Release Bluz* | `release-pipeline-cloud.yml` — *Build and Release Bluz (Cloud Runners)* |
| `docs.yml` — *Deploy Documentation* | `docs-cloud.yml` — *Deploy Documentation (Cloud Runners)* |
| `e2e.yml` | **no mirror — E2E stays self-hosted** |

The mirrors are identical to their originals except for two things: `runs-on:`
(every `[self-hosted, ...]` label set became `ubuntu-latest`) and a
`vars.BLUZ_CI_RUNNER == 'cloud'` clause prepended to each job's `if:`. No
original file was edited.

**The mirrors are inert by default.** With `BLUZ_CI_RUNNER` unset, every mirror
job is skipped, so merging them changes nothing about how CI runs.

## Quick Start

Switch to cloud runners:

```bash
gh variable set BLUZ_CI_RUNNER --body cloud
gh workflow disable release-pipeline.yml
gh workflow disable docs.yml
```

Switch back to self-hosted runners:

```bash
gh variable delete BLUZ_CI_RUNNER
gh workflow enable release-pipeline.yml
gh workflow enable docs.yml
```

Check current state:

```bash
gh variable list
gh workflow list --all
```

Same thing in the UI: **Settings → Secrets and variables → Actions → Variables**
for the variable, **Actions → pick the workflow → `...` → Disable/Enable
workflow** for the originals.

## Why both steps

The variable turns the mirrors on; disabling the originals turns the
self-hosted copies off. They are independent, and skipping the second step is
the dangerous one: both copies of a pair publish real artifacts — GHCR images,
GitHub Releases, and a push to `System-B90/.github` — so on a `v*` tag two
pipelines would race to publish the same release.

Setting the variable while leaving the originals enabled is safe on PRs and
branch pushes (duplicate lint/build runs, wasted minutes) but never do it on a
tag.

## Permanent revert

Delete `release-pipeline-cloud.yml`, `docs-cloud.yml`, and this file, then make
sure the two originals are enabled and `BLUZ_CI_RUNNER` is unset.

## Notes

- Branch protection matches required checks by **job name**, not workflow name.
  Job names are unchanged (`Lint + Typecheck + Unit Tests`, `Build UI Image`,
  …), so existing required checks are satisfied by whichever fleet is live.
- `concurrency.group` keys off `github.workflow`, so a mirror never cancels its
  self-hosted twin.
- Comments inside the mirrors still describe self-hosted behaviour (persistent
  npm/pip disk, shared buildx state). They are inert on ephemeral cloud runners,
  kept verbatim so the two files stay diffable line-for-line.
