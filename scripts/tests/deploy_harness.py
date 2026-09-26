"""
Name: deploy_harness.py
Purpose: Drives the shared sb90-deploy upgrade flow against a Bluz bundle laid
    out exactly as the release job builds it (deploy/app.json + the release
    compose file), with a stub `docker` standing in for the daemon.
Created: 2026-09-26
Author: Michael K. Steinberg

update.sh moved into sb90-deploy (System-B90/deploy-py); these tests keep
covering it from Bluz's side, with Bluz's real app.json, so a change to
either one that breaks a Bluz upgrade fails here.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from sb90_deploy.bundle import populate
from sb90_deploy.spec import AppSpec

ROOT = Path(__file__).resolve().parents[2]
APP_JSON = ROOT / "deploy" / "app.json"

# Logs argv as JSON, answers the queries the upgrade makes. STUB_FAIL_ON makes
# the first command containing that substring exit 42, so a test can stop the
# flow right after the step it cares about.
DOCKER_STUB = r"""
import json, os, sys
args = sys.argv[1:]
with open(os.environ["DOCKER_CALL_LOG"], "a") as log:
    log.write(json.dumps(args) + "\n")
joined = " " + " ".join(args) + " "
fail_on = os.environ.get("STUB_FAIL_ON")
if fail_on and fail_on in joined:
    sys.exit(42)
if " ps --status running --quiet " in joined:
    print("fake-container-id")
elif " ps --format {{.Image}} " in joined:
    print("ghcr.io/system-b90/bluz/" + args[-1] + ":" + os.environ.get("STUB_TAG", ""))
elif " exec " in joined:
    print(json.dumps({"status": "ok", "checks": {"postgres": "ok", "mongo": "ok"}}))
sys.exit(0)
"""


def make_bundle(dest: Path, version: str) -> Path:
    """A real Bluz bundle tree (every app.json bundle file, the shims, VERSION)."""
    dest.mkdir(parents=True)
    populate(dest, AppSpec.load(str(APP_JSON)), APP_JSON, ROOT, version)
    return dest


def make_deployment(tmp_path: Path) -> Path:
    """The running v1.0.0 deployment, with the host state an upgrade must keep."""
    work_dir = make_bundle(tmp_path / "deploy", "v1.0.0")
    (work_dir / "install.sh").write_text("# install v1\n")
    (work_dir / ".env").write_text("BLUZ_VERSION=v1.0.0\nSECRET=keep-me\n")
    (work_dir / "nginx" / "ssl").mkdir(parents=True)
    (work_dir / "nginx" / "ssl" / "cert.pem").write_text("old-cert\n")
    return work_dir


def make_package(tmp_path: Path, version: str = "v2.0.0", images: bool = True) -> Path:
    pkg = make_bundle(tmp_path / "package" / "bluz", version)
    (pkg / "install.sh").write_text(f"# install {version}\n")
    if images:
        (pkg / "images").mkdir()
        for name in (
            "bluz-ui",
            "bluz-sessions",
            "bluz-proxy",
            "postgres",
            "mongodb-community-server",
        ):
            (pkg / "images" / f"{name}.tar").write_text(f"fake {name} archive\n")
    return pkg


def run_update(work_dir: Path, tmp_path: Path, *args: str, env: dict | None = None):
    stub = tmp_path / "docker_stub.py"
    stub.write_text(DOCKER_STUB)
    call_log = tmp_path / "docker-calls.log"
    call_log.touch()
    full_env = {
        **os.environ,
        "SB90_DOCKER": str(stub),
        "DOCKER_CALL_LOG": str(call_log),
        "NO_COLOR": "1",
        **(env or {}),
    }
    for name in ("BLUZ_COMPOSE_OVERLAY", "HIVE_NETWORK_NAME", "BLUZ_VERSION"):
        if name not in (env or {}):
            full_env.pop(name, None)
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "sb90_deploy",
            "update",
            "--root",
            str(work_dir),
            *args,
            "--skip-backup",
            "--yes",
        ],
        env=full_env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    result.docker_calls = [
        json.loads(line) for line in call_log.read_text().splitlines()
    ]  # type: ignore[attr-defined]
    return result
