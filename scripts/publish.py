"""
Name: publish.py
Purpose: Automated release management utility. Calculates semantic versions, updates manifests, and manages Git tags.
Created: 2026-04-12
Author: Michael K. Steinberg (Modified by Gemini)
"""

import json
import logging
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import typer
from InquirerPy import inquirer
from InquirerPy.base.control import Choice
from tqdm import tqdm

app = typer.Typer(help="Bluz Publishing Utility", add_completion=False)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ROOT_PACKAGE = Path("package.json")
SESSIONS_PACKAGE = Path("session-server/package.json")

STATE = {"verbose": False}
TAG_BASE_BRANCH_NAMES = (
    "master",
    "dev",
)


def run_git(
    cmd: str, check: bool = True, description: Optional[str] = None
) -> Optional[str]:
    """
    Executes a git command with optional verbosity and progress tracking.

    Args:
        cmd: The git subcommand and arguments.
        check: Whether to exit the script on command failure.
        description: Optional text for the tqdm progress bar.

    Returns:
        The command output or None.
    """
    if STATE["verbose"]:
        typer.secho(f"> git {cmd}", dim=True)

    with tqdm(total=1, desc=description, disable=not description, leave=False) as pbar:
        try:
            result = subprocess.run(
                f"git {cmd}",
                shell=True,
                text=True,
                check=check,
                capture_output=True,
            )
            pbar.update(1)
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            # If commit fails because of an empty index, we handle it gracefully in main
            if "commit" in cmd and "nothing to commit" in (e.stdout + e.stderr).lower():
                return ""
            logger.error("Git command failed: git %s", cmd)
            if e.stderr:
                logger.error(e.stderr.strip())
            if check:
                raise typer.Exit(code=1)
            return None


def get_remote_url() -> str:
    """
    Retrieves the GitHub base URL for the current repository.

    Returns:
        The web URL for the repository.
    """
    remote = run_git("remote get-url origin") or ""
    match = re.search(r"github\.com[:/](.+?)(?:\.git)?$", remote)
    if not match:
        return "https://github.com/unknown/repository"
    return f"https://github.com/{match.group(1)}"


def get_version_info() -> Tuple[int, int, int, Optional[int]]:
    """
    Parses the latest git tag into semver components.

    Returns:
        A tuple of (major, minor, patch, rc_index).
    """
    run_git("fetch --tags origin", description="Fetching remote tags")

    # Fetch all tags matching v* sorted by version descending
    tags_output = run_git('tag -l --sort=-v:refname "v*"', check=False)

    if not tags_output:
        logger.info("No existing tags found. Starting at v0.0.0")
        return 0, 0, 0, None

    # Isolate the first line (latest version) from the multi-line output
    latest_tag = tags_output.splitlines()[0].strip()

    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.?(\d+))?$", latest_tag)
    if not match:
        logger.error("Tag '%s' does not match semver format.", latest_tag)
        raise typer.Exit(code=1)

    return (
        int(match.group(1)),
        int(match.group(2)),
        int(match.group(3)),
        int(match.group(4)) if match.group(4) else None,
    )


def update_manifests(version: str) -> List[Path]:
    """
    Writes the new version to project package.json files.

    Args:
        version: The semantic version string.

    Returns:
        A list of paths that were successfully updated.
    """
    updated: List[Path] = []
    for path in [ROOT_PACKAGE, SESSIONS_PACKAGE]:
        if not path.exists():
            logger.warning("File %s not found. Skipping.", path)
            continue

        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        data["version"] = version

        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        updated.append(path)

    return updated


@app.command()
def main(
    verbose: bool = typer.Option(
        False,
        "-v",
        "--verbose",
        help="Print all internal commands in a faded font style.",
    ),
    dry: bool = typer.Option(
        False,
        "--dry",
        help="Perform a dry run: execute all local steps but skip pushing and delete the tag afterward.",
    ),
) -> None:
    """
    Executes the interactive release and publishing workflow.
    """
    STATE["verbose"] = verbose
    typer.secho(
        "🚀 Bluz Release Manager" + (" [DRY RUN]" if dry else "") + "\n",
        fg=typer.colors.CYAN,
        bold=True,
    )

    current_branch = run_git("rev-parse --abbrev-ref HEAD")
    if current_branch not in TAG_BASE_BRANCH_NAMES:
        typer.secho(
            f"❌ Error: Must be on one of {' or '.join(TAG_BASE_BRANCH_NAMES)} branch. (Current: {current_branch})",
            fg=typer.colors.RED,
        )
        raise typer.Exit(code=1)

    if run_git("status --porcelain"):
        typer.secho("❌ Error: Working directory is not clean.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    major, minor, patch, rc = get_version_info()
    curr_str = f"{major}.{minor}.{patch}" + (f"-rc.{rc}" if rc is not None else "")
    typer.echo(
        f"Current Version: {typer.style(f'v{curr_str}', fg=typer.colors.YELLOW)}"
    )

    bump_type = inquirer.select(
        message="What type of update is this?",
        choices=[
            Choice("patch", name="Patch (Bug Fixes)"),
            Choice("minor", name="Minor (New Features)"),
            Choice("major", name="Major (Breaking API Changes)"),
        ],
        default="patch",
    ).execute()

    is_rc = inquirer.confirm(
        message="Is this a release candidate?", default=False
    ).execute()

    if bump_type == "major":
        major, minor, patch, rc = major + 1, 0, 0, None
    elif bump_type == "minor":
        minor, patch, rc = minor + 1, 0, None
    else:
        if rc is None:
            patch += 1

    rc = (rc + 1 if rc is not None else 1) if is_rc else None
    new_version = f"{major}.{minor}.{patch}" + (f"-rc.{rc}" if rc is not None else "")
    new_tag = f"v{new_version}"

    if not inquirer.confirm(message=f"Publish {new_tag}?", default=True).execute():
        typer.echo("Aborted.")
        raise typer.Exit()

    updated_files = update_manifests(new_version)
    run_git(f"add {' '.join(p.as_posix() for p in updated_files)}")
    run_git(f'commit --no-verify -m "chore: bump version to {new_version}"')
    run_git(f'tag -a {new_tag} -m "Release {new_version}"')

    if not dry:
        run_git(
            f"push origin {current_branch}",
            description=f"Pushing {current_branch} branch",
        )
        run_git(f"push origin {new_tag}", description=f"Pushing tag {new_tag}")
    else:
        typer.secho(
            "\n⚠️ Dry run active: Skipping push to remote.", fg=typer.colors.YELLOW
        )
        run_git(f"tag -d {new_tag}", description=f"Deleting temporary tag {new_tag}")

    base_url = get_remote_url()
    typer.secho(
        f"\n🎉 Successfully {'simulated' if dry else 'published'} {new_tag}",
        fg=typer.colors.GREEN,
        bold=True,
    )

    if not dry:
        typer.echo(f"\n🔗 {typer.style('GitHub Links:', bold=True)}")
        typer.echo(f"  Tag:      {base_url}/releases/tag/{new_tag}")
        typer.echo(f"  Action:   {base_url}/actions/workflows/build.yml")


if __name__ == "__main__":
    if not Path(".git").exists():
        typer.secho("❌ Error: Must run from repository root.", fg=typer.colors.RED)
        sys.exit(1)
    app()
