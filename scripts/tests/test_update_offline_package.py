"""
Name: test_update_offline_package.py
Purpose: Covers scripts/update.sh --package: in-place upgrade of a deployment
    from a full new offline package (image load, bundle refresh, guards).
Created: 2026-09-08
Author: Michael K. Steinberg
"""

import os
import stat
import subprocess
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
UPDATE_SH = ROOT / "scripts" / "update.sh"

pytestmark = pytest.mark.skipif(
    os.name == "nt", reason="update.sh is a bash script; run under WSL/git-bash CI"
)

# Carries update.sh from startup through the image load and the bundle refresh,
# then fails the first `compose up` so the test stops before the roll — the
# offline-specific work all happens before that point.
DOCKER_STUB = """#!/usr/bin/env bash
echo "$@" >> "$DOCKER_CALL_LOG"

if [ "$1" = "info" ]; then exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi

case " $* " in
    *" ps --status running --quiet "*) echo "fake-container-id"; exit 0 ;;
    *" up -d "*) exit 42 ;;
esac
exit 0
"""


def _make_deployment(tmp_path: Path) -> tuple[Path, Path]:
    """The running deployment: bundle root with the OLD files in place."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker_stub = bin_dir / "docker"
    docker_stub.write_text(DOCKER_STUB)
    docker_stub.chmod(docker_stub.stat().st_mode | stat.S_IEXEC)

    work_dir = tmp_path / "deploy"
    (work_dir / "scripts").mkdir(parents=True)
    (work_dir / "scripts" / "update.sh").write_text(UPDATE_SH.read_text())
    (work_dir / "scripts" / "update.sh").chmod(0o755)
    (work_dir / "docker-compose.yml").write_text("services: {}  # v1\n")
    (work_dir / "install.sh").write_text("# install v1\n")
    (work_dir / "VERSION").write_text("v1.0.0\n")
    (work_dir / ".env").write_text("BLUZ_VERSION=v1.0.0\nSECRET=keep-me\n")
    (work_dir / "nginx" / "ssl").mkdir(parents=True)
    (work_dir / "nginx" / "ssl" / "cert.pem").write_text("old-cert\n")
    return bin_dir, work_dir


def _make_package(
    tmp_path: Path, *, version: str = "v2.0.0", images: bool = True
) -> Path:
    """A full new offline package, laid out exactly as the release job builds it."""
    pkg = tmp_path / "package" / "bluz"
    (pkg / "backup").mkdir(parents=True)
    (pkg / "docker-compose.yml").write_text(f"services: {{}}  # {version}\n")
    (pkg / "install.sh").write_text(f"# install {version}\n")
    (pkg / "update.sh").write_text(f"# update {version}\n")
    (pkg / "backup" / "bluz-backup.sh").write_text(f"# backup {version}\n")
    (pkg / "VERSION").write_text(f"{version}\n")
    if images:
        (pkg / "images").mkdir()
        for name in ("bluz-ui", "bluz-sessions", "bluz-proxy", "postgres", "mongodb"):
            (pkg / "images" / f"{name}.tar").write_text(f"fake {name} archive\n")
    return pkg


def _run(work_dir: Path, bin_dir: Path, tmp_path: Path, *args: str):
    call_log = tmp_path / "docker-calls.log"
    if not call_log.exists():
        call_log.write_text("")
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}",
        "DOCKER_CALL_LOG": str(call_log),
    }
    result = subprocess.run(
        ["bash", "./scripts/update.sh", *args, "--skip-backup", "--yes"],
        cwd=work_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    result.docker_calls = call_log.read_text()  # type: ignore[attr-defined]
    return result


def test_loads_every_image_and_refreshes_bundle_from_package(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)
    pkg = _make_package(tmp_path)

    result = _run(work_dir, bin_dir, tmp_path, "--package", str(pkg))

    # Version came from the package, not from GitHub.
    assert "offline package: v2.0.0" in result.stdout
    assert "resolving latest release" not in result.stdout

    # Every archive is loaded, database images included: a release may move the
    # pinned postgres/mongo tags and an air-gapped host has them nowhere else.
    loads = [
        line for line in result.docker_calls.splitlines() if line.startswith("load ")
    ]
    assert len(loads) == 5, result.docker_calls
    assert any("postgres.tar" in line for line in loads)

    # No registry access anywhere in the run.
    assert not [line for line in result.docker_calls.splitlines() if " pull" in line]

    # Bundle files replaced; the previous copies kept.
    assert (work_dir / "docker-compose.yml").read_text() == "services: {}  # v2.0.0\n"
    assert (work_dir / "backup" / "bluz-backup.sh").read_text() == "# backup v2.0.0\n"
    assert (work_dir / "VERSION").read_text().strip() == "v2.0.0"
    bak = work_dir / ".bundle-bak-v1.0.0"
    assert (bak / "docker-compose.yml").read_text() == "services: {}  # v1\n"
    assert (bak / "install.sh").read_text() == "# install v1\n"

    # Host-specific state untouched, and the new tag persisted for compose.
    assert "SECRET=keep-me" in (work_dir / ".env").read_text()
    assert "BLUZ_VERSION=v2.0.0" in (work_dir / ".env").read_text()
    assert (work_dir / "nginx" / "ssl" / "cert.pem").read_text() == "old-cert\n"


def test_accepts_the_tarball_and_descends_into_its_wrapper_dir(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)
    pkg = _make_package(tmp_path)
    tarball = tmp_path / "bluz-offline-v2.0.0.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(pkg, arcname="bluz")

    result = _run(work_dir, bin_dir, tmp_path, "--package", str(tarball))

    assert "offline package: v2.0.0" in result.stdout
    assert (work_dir / "docker-compose.yml").read_text() == "services: {}  # v2.0.0\n"


def test_rejects_the_online_bundle(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)
    pkg = _make_package(tmp_path, images=False)

    result = _run(work_dir, bin_dir, tmp_path, "--package", str(pkg))

    assert result.returncode != 0
    assert "ONLINE bundle" in result.stdout + result.stderr
    # Nothing was touched.
    assert (work_dir / "docker-compose.yml").read_text() == "services: {}  # v1\n"
    assert "BLUZ_VERSION=v1.0.0" in (work_dir / ".env").read_text()


def test_rejects_a_package_holding_the_running_version(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)
    pkg = _make_package(tmp_path, version="v1.0.0")

    result = _run(work_dir, bin_dir, tmp_path, "--package", str(pkg))

    assert result.returncode != 0
    assert "Already running v1.0.0" in result.stdout + result.stderr


def test_package_and_version_are_mutually_exclusive(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)
    pkg = _make_package(tmp_path)

    result = _run(
        work_dir, bin_dir, tmp_path, "--package", str(pkg), "--version", "v3.0.0"
    )

    assert result.returncode != 0
    assert "mutually exclusive" in result.stdout + result.stderr


def test_missing_package_path_fails_before_touching_anything(tmp_path: Path) -> None:
    bin_dir, work_dir = _make_deployment(tmp_path)

    result = _run(
        work_dir, bin_dir, tmp_path, "--package", str(tmp_path / "nope.tar.gz")
    )

    assert result.returncode != 0
    assert "Package not found" in result.stdout + result.stderr
    assert "BLUZ_VERSION=v1.0.0" in (work_dir / ".env").read_text()
