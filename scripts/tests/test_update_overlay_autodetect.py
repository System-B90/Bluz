"""
Name: test_update_overlay_autodetect.py
Purpose: Regression test for scripts/update.sh auto-detecting the co-located
    Hive compose overlay from a link-hive.sh-persisted .env (#547).
Created: 2026-09-03
Author: Michael K. Steinberg
"""

import os
import stat
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
UPDATE_SH = ROOT / "scripts" / "update.sh"

# A stub `docker` on PATH that logs every invocation's argv to
# DOCKER_CALL_LOG, then answers just enough to carry update.sh from startup
# through its `compose pull` call (the first place OVERLAY_ARGS is actually
# used against a real docker invocation), then deliberately fails so the
# script stops right there — we only need to see what pull was called with.
DOCKER_STUB = """#!/usr/bin/env bash
echo "$@" >> "$DOCKER_CALL_LOG"

if [ "$1" = "info" ]; then exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi

case " $* " in
    *" ps --status running --quiet "*) echo "fake-container-id"; exit 0 ;;
    *" pull "*) exit 42 ;;
esac
exit 0
"""


def _make_bundle(tmp_path: Path) -> tuple[Path, Path]:
    """Mirrors a real release bundle: docker-compose.yml/.env at the bundle
    root, update.sh under scripts/ — SCRIPT_DIR/../ only resolves to the
    overlay correctly with this exact layout (#547)."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker_stub = bin_dir / "docker"
    docker_stub.write_text(DOCKER_STUB)
    docker_stub.chmod(docker_stub.stat().st_mode | stat.S_IEXEC)

    work_dir = tmp_path / "deploy"
    (work_dir / "scripts").mkdir(parents=True)
    (work_dir / "scripts" / "update.sh").write_text(UPDATE_SH.read_text())
    (work_dir / "scripts" / "update.sh").chmod(0o755)
    (work_dir / "docker-compose.yml").write_text("services: {}\n")
    (work_dir / "docker-compose.hive-local.yml").write_text("services: {}\n")

    return bin_dir, work_dir


def _run_update(
    tmp_path: Path, *, link_hive_ran: bool
) -> "subprocess.CompletedProcess[str]":
    bin_dir, work_dir = _make_bundle(tmp_path)

    env_lines = ["BLUZ_VERSION=v1.0.0"]
    if link_hive_ran:
        env_lines.append("HIVE_NETWORK_NAME=deploy_hive_net")
    (work_dir / ".env").write_text("\n".join(env_lines) + "\n")

    call_log = tmp_path / "docker-calls.log"
    call_log.write_text("")

    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}",
        "DOCKER_CALL_LOG": str(call_log),
    }

    result = subprocess.run(
        [
            "bash",
            "./scripts/update.sh",
            "--version",
            "v2.0.0",
            "--skip-backup",
            "--yes",
        ],
        cwd=work_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    result.docker_calls = call_log.read_text()  # type: ignore[attr-defined]
    return result


@pytest.mark.skipif(
    os.name == "nt", reason="update.sh is a bash script; run under WSL/git-bash CI"
)
def test_autodetects_overlay_when_link_hive_persisted_hive_network_name(
    tmp_path: Path,
) -> None:
    result = _run_update(tmp_path, link_hive_ran=True)

    assert "co-located Hive detected" in result.stdout
    pull_calls = [line for line in result.docker_calls.splitlines() if " pull" in line]
    assert pull_calls, (
        f"expected a `docker compose ... pull` call, got: {result.docker_calls!r}"
    )
    assert "docker-compose.hive-local.yml" in pull_calls[0]


@pytest.mark.skipif(
    os.name == "nt", reason="update.sh is a bash script; run under WSL/git-bash CI"
)
def test_no_overlay_when_link_hive_never_ran(tmp_path: Path) -> None:
    result = _run_update(tmp_path, link_hive_ran=False)

    assert "co-located Hive detected" not in result.stdout
    pull_calls = [line for line in result.docker_calls.splitlines() if " pull" in line]
    assert pull_calls, (
        f"expected a `docker compose ... pull` call, got: {result.docker_calls!r}"
    )
    assert "docker-compose.hive-local.yml" not in pull_calls[0]


@pytest.mark.skipif(
    os.name == "nt", reason="update.sh is a bash script; run under WSL/git-bash CI"
)
def test_explicit_overlay_env_var_still_wins(tmp_path: Path) -> None:
    """BLUZ_COMPOSE_OVERLAY set by hand must not be clobbered by autodetect."""
    bin_dir, work_dir = _make_bundle(tmp_path)
    custom_overlay = work_dir / "docker-compose.custom.yml"
    custom_overlay.write_text("services: {}\n")
    (work_dir / ".env").write_text(
        "BLUZ_VERSION=v1.0.0\nHIVE_NETWORK_NAME=deploy_hive_net\n"
    )

    call_log = tmp_path / "docker-calls.log"
    call_log.write_text("")

    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}",
        "DOCKER_CALL_LOG": str(call_log),
        "BLUZ_COMPOSE_OVERLAY": str(custom_overlay),
    }

    result = subprocess.run(
        [
            "bash",
            "./scripts/update.sh",
            "--version",
            "v2.0.0",
            "--skip-backup",
            "--yes",
        ],
        cwd=work_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert "co-located Hive detected" not in result.stdout
    pull_calls = [line for line in call_log.read_text().splitlines() if " pull" in line]
    assert pull_calls
    assert "docker-compose.custom.yml" in pull_calls[0]
    assert "docker-compose.hive-local.yml" not in pull_calls[0]
