"""
Name: scripts/parse_pipeline_logs.py
Purpose: Automatically fetch and parse failed GitHub Actions pipeline logs.
Created: 2026-06-16
Author: Michael K. Steinberg
"""

import os
import re
import subprocess
import sys
from typing import Dict, List, Optional
import typer

app = typer.Typer(help="Parse failed GitHub Actions pipeline logs.")


def clean_ansi(text: str) -> str:
    """Remove ANSI escape codes (both escape chars and literal caret representations) from text."""
    # Matches both standard ESC (\x1b) and literal '^[' caret representations
    ansi_pattern = re.compile(r"(?:\x1B|\^\[)\[[0-9;]*[a-zA-Z]")
    return ansi_pattern.sub("", text)


def get_current_branch() -> str:
    """Get the current git branch name."""
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.SubprocessError:
        return ""


def get_latest_failed_run(branch: Optional[str] = None) -> Optional[str]:
    """Get the databaseId of the latest failed run for the branch/repository."""
    env = os.environ.copy()
    # Pop dummy token to let gh use local config/auth
    if "GITHUB_TOKEN" in env and env["GITHUB_TOKEN"].startswith(
        "github_pat_antigravity"
    ):
        env.pop("GITHUB_TOKEN", None)

    cmd = [
        "gh",
        "run",
        "list",
        "--limit",
        "10",
        "--status",
        "failure",
        "--json",
        "databaseId,headBranch,workflowName",
    ]
    try:
        result = subprocess.run(
            cmd, env=env, capture_output=True, text=True, check=True
        )
        import json

        runs = json.loads(result.stdout)
        if not runs:
            return None

        # If branch is specified, try to find a match
        if branch:
            for run in runs:
                if run.get("headBranch") == branch:
                    return str(run.get("databaseId"))

        # Fallback to the first failed run
        return str(runs[0].get("databaseId"))
    except Exception as e:
        typer.echo(f"Error fetching run list: {e}", err=True)
        return None


def fetch_logs(run_id: str) -> str:
    """Fetch failed logs for the given run ID."""
    env = os.environ.copy()
    if "GITHUB_TOKEN" in env and env["GITHUB_TOKEN"].startswith(
        "github_pat_antigravity"
    ):
        env.pop("GITHUB_TOKEN", None)

    cmd = ["gh", "run", "view", run_id, "--log-failed"]
    try:
        result = subprocess.run(
            cmd, env=env, capture_output=True, text=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        typer.echo(f"Error executing gh run view: {e.stderr}", err=True)
        sys.exit(1)


def parse_logs(raw_logs: str) -> Dict[str, Dict[str, List[str]]]:
    """Group log lines by Job and Step, filtering out boilerplate."""
    parsed: Dict[str, Dict[str, List[str]]] = {}
    clean_content = clean_ansi(raw_logs)

    # Common env/setup line prefixes or substrings to discard
    ignore_patterns = [
        r"^##\[group\]",
        r"^##\[endgroup\]",
        r"^shell:\s+",
        r"^env:\s+",
        r"^\s*REGISTRY:",
        r"^\s*IMAGE_NAME",
        r"^\s*IMAGE_POSTGRES",
        r"^\s*IMAGE_MONGO",
        r"^\s*pythonLocation:",
        r"^\s*PKG_CONFIG",
        r"^\s*Python_ROOT",
        r"^\s*Python\d+_ROOT",
        r"^\s*LD_LIBRARY_PATH:",
    ]
    ignore_regex = [re.compile(p) for p in ignore_patterns]

    for line in clean_content.splitlines():
        if not line.strip():
            continue

        parts = line.split("\t", 2)
        if len(parts) < 3:
            continue

        job, step, rest = parts[0].strip(), parts[1].strip(), parts[2].strip()

        # Remove timestamp (supports BOM prefixes, other leading chars, and space separation)
        log_msg = re.sub(
            r"^.*?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*",
            "",
            rest,
        ).strip()

        # Filter boilerplate lines
        if any(rx.search(log_msg) for rx in ignore_regex):
            continue

        if job not in parsed:
            parsed[job] = {}
        if step not in parsed[job]:
            parsed[job][step] = []

        parsed[job][step].append(log_msg)

    return parsed


@app.command()
def main(
    run_id: Optional[str] = typer.Option(
        None,
        "--run-id",
        "-r",
        help="GitHub Run ID to parse. Defaults to latest on current branch.",
    ),
    branch: Optional[str] = typer.Option(
        None, "--branch", "-b", help="Branch name to look up failed runs for."
    ),
):
    """Fetch and parse failed logs from GitHub Actions workflow runs."""
    if not run_id:
        lookup_branch = branch or get_current_branch()
        typer.echo(f"Searching for failed runs on branch: {lookup_branch or 'any'}")
        run_id = get_latest_failed_run(lookup_branch)
        if not run_id:
            typer.echo("No failed runs found.")
            sys.exit(0)

    typer.echo(f"Fetching failed logs for Run ID: {run_id}...")
    raw_logs = fetch_logs(run_id)

    if not raw_logs.strip():
        typer.echo("No failed logs returned by GitHub CLI.")
        sys.exit(0)

    grouped = parse_logs(raw_logs)

    if not grouped:
        typer.echo("Could not parse any failed steps or all logs were filtered out.")
        sys.exit(0)

    typer.echo("\n" + "=" * 80)
    typer.echo("FAILED PIPELINE LOG SUMMARY")
    typer.echo("=" * 80)

    for job, steps in grouped.items():
        typer.echo(f"\nJob: {job}")
        for step, lines in steps.items():
            typer.echo(f"  Step: {step}")
            typer.echo("  " + "-" * 40)
            for line in lines:
                typer.echo(f"    {line}")
            typer.echo("  " + "-" * 40)

    typer.echo("=" * 80 + "\n")


if __name__ == "__main__":
    app()
