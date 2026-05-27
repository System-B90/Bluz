# Automation Scripts (`scripts`)

## Purpose
This directory contains utility files, developer tools, database seeding scripts, setup helpers, and custom build-step runners. These files do not run as part of the core runtime server or client bundle, but are invoked during local development, system installation, codebase refactoring, or continuous integration processes.

---

## Directory Structure

*   This directory contains self-contained shell files (`.sh`), Python scripts (`.py`), and raw JavaScript tasks (`.js`) designed to run directly in terminal shells.
*   **Seeding & Setups**: Automated setups to prepare databases (e.g., populating Hive mocks, running migrations scripts).
*   **Code Refactoring Helpers**: Custom JS ast runners used during large-scale code transformations (e.g., standardizing imports, removing redundant files).

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:
*   It is a **utility script, runner, or batch command** executed manually or by a CI runner to automate local setup, testing, seeding, or code cleanup tasks.
*   It configures local development hooks or dependency installation routines.

### ❌ NO, do NOT put it here if:
*   It is parsed during runtime execution of the client bundle or backend Next.js API. Place these in **`ui/src/`**.
*   It performs permanent database schema declarations or handles Drizzle-native migration paths. Place these in **`drizzle/`**.
