"""
Name: test_update_offline_package.py
Purpose: Covers `./update.sh --package`: in-place upgrade of a deployment from a
    full new offline package (image load, bundle refresh, guards). The flow now
    lives in sb90-deploy; these run it against Bluz's real app.json.
Created: 2026-09-08
Author: Michael K. Steinberg
"""

import tarfile
from pathlib import Path

from deploy_harness import make_deployment, make_package, run_update


def _loads(result) -> list[list[str]]:
    return [c for c in result.docker_calls if c[:1] == ["load"]]


def test_loads_every_image_and_refreshes_bundle_from_package(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)
    pkg = make_package(tmp_path)

    result = run_update(
        work_dir, tmp_path, "--package", str(pkg), env={"STUB_TAG": "v2.0.0"}
    )

    assert result.returncode == 0, result.stdout + result.stderr
    # Version came from the package, not from GitHub.
    assert "offline package: v2.0.0" in result.stdout
    assert "resolving latest release" not in result.stdout

    # Every archive is loaded, database images included: a release may move the
    # pinned postgres/mongo tags and an air-gapped host has them nowhere else.
    assert len(_loads(result)) == 5, result.docker_calls
    assert any("postgres.tar" in c[-1] for c in _loads(result))
    # Bluz's three own images are verified at the target tag before the roll.
    inspected = [c[-1] for c in result.docker_calls if c[:2] == ["image", "inspect"]]
    assert sorted(inspected) == [
        "ghcr.io/system-b90/bluz/proxy:v2.0.0",
        "ghcr.io/system-b90/bluz/sessions:v2.0.0",
        "ghcr.io/system-b90/bluz/ui:v2.0.0",
    ]

    # No registry access anywhere in the run.
    assert not [c for c in result.docker_calls if "pull" in c]

    # Rolled ui -> sessions -> proxy.
    rolled = [c[-1] for c in result.docker_calls if "--no-deps" in c]
    assert rolled == ["ui", "sessions", "proxy"]

    # Bundle files replaced; the previous copies kept.
    assert (work_dir / "install.sh").read_text() == "# install v2.0.0\n"
    assert (work_dir / "VERSION").read_text().strip() == "v2.0.0"
    assert (
        work_dir / ".bundle-bak-v1.0.0" / "install.sh"
    ).read_text() == "# install v1\n"

    # Host-specific state untouched, and the new tag persisted for compose.
    env = (work_dir / ".env").read_text()
    assert "SECRET=keep-me" in env and "BLUZ_VERSION=v2.0.0" in env
    assert (work_dir / "nginx" / "ssl" / "cert.pem").read_text() == "old-cert\n"


def test_accepts_the_tarball_and_descends_into_its_wrapper_dir(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)
    pkg = make_package(tmp_path)
    tarball = tmp_path / "bluz-offline-v2.0.0.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(pkg, arcname="bluz")

    result = run_update(
        work_dir, tmp_path, "--package", str(tarball), env={"STUB_TAG": "v2.0.0"}
    )

    assert "offline package: v2.0.0" in result.stdout
    assert (work_dir / "install.sh").read_text() == "# install v2.0.0\n"


def test_rejects_the_online_bundle(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)
    pkg = make_package(tmp_path, images=False)

    result = run_update(work_dir, tmp_path, "--package", str(pkg))

    assert result.returncode != 0
    assert "ONLINE bundle" in result.stdout + result.stderr
    # Nothing was touched.
    assert (work_dir / "install.sh").read_text() == "# install v1\n"
    assert "BLUZ_VERSION=v1.0.0" in (work_dir / ".env").read_text()


def test_rejects_a_package_holding_the_running_version(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)
    pkg = make_package(tmp_path, version="v1.0.0")

    result = run_update(work_dir, tmp_path, "--package", str(pkg))

    assert result.returncode != 0
    assert "Already running v1.0.0" in result.stdout + result.stderr


def test_package_and_version_are_mutually_exclusive(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)
    pkg = make_package(tmp_path)

    result = run_update(
        work_dir, tmp_path, "--package", str(pkg), "--version", "v3.0.0"
    )

    assert result.returncode != 0
    assert "cannot be combined" in result.stdout + result.stderr


def test_missing_package_path_fails_before_touching_anything(tmp_path: Path) -> None:
    work_dir = make_deployment(tmp_path)

    result = run_update(work_dir, tmp_path, "--package", str(tmp_path / "nope.tar.gz"))

    assert result.returncode != 0
    assert "Package not found" in result.stdout + result.stderr
    assert "BLUZ_VERSION=v1.0.0" in (work_dir / ".env").read_text()
