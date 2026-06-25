---
name: github-cli
description: gh CLI commands for PRs, issues, CI checks, and the feature branch workflow.
tags: [github, git, pr, ci]
---

## PR Commands
```powershell
gh pr list
gh pr status
gh pr view <n>                    # add --json for structured data, --web for browser
gh pr checkout <n>
gh pr diff <n>
gh pr create --title "Vibe-Added X" --body "desc" --base dev
gh pr merge --squash --delete-branch
gh pr review <n> --approve --body "LGTM"
gh pr review <n> --request-changes --body "Fix X"
gh pr review <n> --comment --body "text"
gh pr checks
```

## Issue Commands
```powershell
gh issue list
gh issue view <n>
gh issue create --title "Bug: X" --body "steps..."
gh issue comment <n> --body "text"
gh issue close <n>
gh issue develop <n> --checkout    # create + checkout branch for issue
```

## CI & Search
```powershell
gh run list
gh run view <run-id>
gh search issues "<query>"
```

## Feature Branch Workflow
```powershell
# 1. Branch from dev
git checkout dev && git pull
git checkout -b feature/your-feature

# 2. Push + open PR
git push --set-upstream origin feature/your-feature
gh pr create --base dev --title "Vibe-Added X" --body "desc"

# 3. Monitor CI
gh pr checks

# 4. Debug failures
python scripts/parse_pipeline_logs.py

# 5. Merge ONLY when all checks green
gh pr merge --squash --delete-branch
```
