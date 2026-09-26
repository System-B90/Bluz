"""
Name: test_update_overlay_autodetect.py
Purpose: Regression test for the upgrade auto-detecting the co-located Hive
    compose overlay from a link-hive-persisted .env (#547). The flow now lives
    in sb90-deploy; this runs it against Bluz's real bundle layout.
Created: 2026-09-03
Author: Michael K. Steinberg
"""

from pathlib import Path

from deploy_harness import make_deployment, run_update

OVERLAY = "docker-compose.hive-local.yml"


def _pull_call(result) -> list[str]:
    pulls = [c for c in result.docker_calls if c[:1] == ["compose"] and "pull" in c]
    assert pulls, result.stdout + result.stderr
    return pulls[0]


def _run(tmp_path: Path, *, link_hive_ran: bool, env: dict | None = None):
    work_dir = make_deployment(tmp_path)
    if link_hive_ran:
        with open(work_dir / ".env", "a") as handle:
            handle.write("HIVE_NETWORK_NAME=hive-stack_hive-net\n")
    # Stop right at `compose pull`: the first command that uses the overlay.
    stop = {"STUB_FAIL_ON": " pull "}
    return work_dir, run_update(
        work_dir, tmp_path, "--version", "v2.0.0", env={**stop, **(env or {})}
    )


def test_autodetects_overlay_when_link_hive_persisted_hive_network_name(
    tmp_path: Path,
) -> None:
    work_dir, result = _run(tmp_path, link_hive_ran=True)
    assert str(work_dir / OVERLAY) in _pull_call(result)
    assert "co-located Hive detected" in result.stdout


def test_no_overlay_when_link_hive_never_ran(tmp_path: Path) -> None:
    _, result = _run(tmp_path, link_hive_ran=False)
    assert not any(OVERLAY in part for part in _pull_call(result))


def test_explicit_overlay_env_var_still_wins(tmp_path: Path) -> None:
    custom = tmp_path / "custom-overlay.yml"
    custom.write_text("services: {}\n")
    _, result = _run(
        tmp_path, link_hive_ran=False, env={"BLUZ_COMPOSE_OVERLAY": str(custom)}
    )
    assert str(custom) in _pull_call(result)
