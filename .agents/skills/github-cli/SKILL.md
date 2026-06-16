---
name: github-cli
description: Use the GitHub CLI (gh.exe) to manage pull requests, issues, branches, and repository state on Windows.
version: 1.0.0
tags:
  - github
  - git
  - pr
  - issues
  - branches
---

# GitHub CLI (gh) Usage Guide

This skill guides the agent on how to use the GitHub CLI (`gh.exe`) to manage pull requests, issues, and branches.

## Execution Environment

The `gh` command-line tool is available globally in the system `PATH`. Run it directly:
```powershell
gh --version
```

---

## 1. Pull Request Management

Use `gh pr` to handle PR review, creation, and branch checkouts.

### View & Checkout PRs
* **List PRs:** `gh pr list`
* **Check Status of PRs related to you:** `gh pr status`
* **View PR Details:** `gh pr view <number>` (add `--web` to view in browser, or `--json` to fetch structured data)
* **Checkout PR locally:** `gh pr checkout <number>`
* **Diff PR changes:** `gh pr diff <number>`

### Create & Merge PRs
* **Create PR (Interactive):** `gh pr create`
* **Create PR (Automatic/Non-interactive):** `gh pr create --fill` (uses commit messages for title and body)
* **Create PR with specific metadata:** `gh pr create --title "feat: add feature" --body "description of changes" --draft`
* **Merge PR:** `gh pr merge <number> --squash --delete-branch` (supports `--merge`, `--squash`, `--rebase`)

### Review & Approve PRs
* **Approve PR:** `gh pr review <number> --approve --body "LGTM"`
* **Request Changes:** `gh pr review <number> --request-changes --body "Please fix X"`
* **Add Comment to PR:** `gh pr review <number> --comment --body "Comment text"`

---

## 2. Issue Management

Use `gh issue` to track, view, and comment on project tasks.

### View Issues
* **List open issues:** `gh issue list` (filter via `--assignee <user>`, `--label <label>`, or `--search <query>`)
* **View Issue Details:** `gh issue view <number>` (use `--web` to view in browser)
* **List status of your issues:** `gh issue status`

### Create & Modify Issues
* **Create Issue:** `gh issue create --title "Bug: error on login" --body "Steps to reproduce..."` (add `--label "bug"` to assign labels)
* **Add Comment to Issue:** `gh issue comment <number> --body "Adding more context here."`
* **Close Issue:** `gh issue close <number>`
* **Reopen Issue:** `gh issue reopen <number>`

### Linked Branches
* **Create and checkout branch for issue:** `gh issue develop <number> --checkout`

---

## 3. General Repository & Search Commands

* **Repository Status/Readme:** `gh repo view`
* **Search Issues/PRs:** `gh search issues "<query>"`
* **Check CI Runs:** `gh run list` or `gh run view <run-id>`
