# Cloud-runner mirrors

Two extra workflow files run all non-E2E CI on GitHub-hosted runners:

| Self-hosted (original) | Cloud mirror |
| --- | --- |
| `release-pipeline.yml` — *Build and Release Bluz* | `release-pipeline-cloud.yml` — *Build and Release Bluz (Cloud Runners)* |
| `docs.yml` — *Deploy Documentation* | `docs-cloud.yml` — *Deploy Documentation (Cloud Runners)* |
| `e2e.yml` | **no mirror — E2E stays self-hosted** |

The mirrors are byte-identical to their originals except for `runs-on:`:
every `[self-hosted, ...]` label set became `ubuntu-latest`. No original file
was edited.

## Quick Start

Run exactly one copy of each pair. Switching is done through the Actions
workflow enable/disable flag — **no file changes, no commits**.

Switch to cloud runners:

```bash
gh workflow disable release-pipeline.yml
gh workflow disable docs.yml
gh workflow enable  release-pipeline-cloud.yml
gh workflow enable  docs-cloud.yml
```

Switch back to self-hosted runners:

```bash
gh workflow disable release-pipeline-cloud.yml
gh workflow disable docs-cloud.yml
gh workflow enable  release-pipeline.yml
gh workflow enable  docs.yml
```

Same thing in the UI: **Actions → pick the workflow → `...` → Disable/Enable
workflow**.

Check current state:

```bash
gh workflow list --all
```

## Why it matters

Both copies of a pair publish real artifacts — GHCR images, GitHub Releases,
and a push to `System-B90/.github`. Leaving both enabled on a `v*` tag means
two pipelines racing to publish the same release. Disable one before enabling
the other.

## Permanent revert

Delete `release-pipeline-cloud.yml`, `docs-cloud.yml`, and this file, then
re-enable the two originals.

## Notes

- Branch protection matches required checks by **job name**, not workflow
  name. Job names are unchanged (`Lint + Typecheck + Unit Tests`, `Build UI
  Image`, …), so existing required checks keep working across the switch.
- `concurrency.group` keys off `github.workflow`, so a mirror never cancels
  its self-hosted twin.
- Comments inside the mirrors still describe self-hosted behaviour (persistent
  npm/pip disk, shared buildx state). They are inert on ephemeral cloud
  runners, kept verbatim so the two files stay diffable line-for-line.
