---
trigger: always_on
---

# Git Workflow Constraints

When handling version control, you must adhere to the following standards:

- **State Verification:** Utilize `git status` and `git diff` autonomously to confirm file states before generating commit instructions.
- **Message Syntax:** Commit messages and pull request titles must strictly start with the word "Vibe" followed by a hyphen and a past-tense verb (e.g., `Vibe-Implemented <description>`, `Vibe-Fixed <description>`, `Vibe-Added <description>`). This replaces prefixes like `chore:`. Branch names are exempt.
- **Auto-Commit Execution:** After major changes, autonomously execute (propose via the run_command tool) a single command-line snippet using `pwsh -Command` to stage and commit the files (e.g., `pwsh -Command "git add <files> && git commit -m 'Vibe-<Past-tense verb> <description>' -n"`). This ensures execution under PowerShell 7 (PWSH 7) on Windows 11 and maintains correct logical command chaining (`&&`). Do not split the staging and committing processes into multiple commands. Use the `-n` flag to bypass the long running linter.