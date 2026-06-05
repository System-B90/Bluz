---
trigger: always_on
---

# Git Workflow Constraints

When handling version control, you must adhere to the following standards:

- **State Verification:** Utilize `git status` and `git diff` autonomously to confirm file states before generating commit instructions.
- **Message Syntax:** Commit messages must strictly start with a past-tense verb.
- **Command Output:** After major changes, always provide a single command-line snippet to add and commit files (e.g., `git add <files> && git commit -m "<Past-tense verb> <description>"`). Do not split the staging and committing processes into multiple commands.
