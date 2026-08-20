"""
Name: test_tools_impl.py
Purpose: Unit tests for the dev-ops CLI shims over sb90_devops.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from pathlib import Path

import pytest
import sb90_devops as devops
import tools_impl


def test_run_binds_repo_root(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}

    def fake_run(cmd, cwd, **kwargs):
        seen["cmd"] = cmd
        seen["cwd"] = cwd
        seen["kwargs"] = kwargs
        return "sentinel"

    monkeypatch.setattr(tools_impl.devops, "run", fake_run)

    assert tools_impl._run(["npm", "run", "lint"], check=True) == "sentinel"
    assert seen["cmd"] == ["npm", "run", "lint"]
    assert seen["cwd"] == tools_impl.ROOT
    assert seen["kwargs"] == {"check": True}


def test_spawn_background_binds_repo_root(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}

    def fake_spawn(cmd, log_file, pid_file, cwd):
        seen.update(cmd=cmd, log_file=log_file, pid_file=pid_file, cwd=cwd)
        return 4242

    monkeypatch.setattr(tools_impl.devops, "spawn_background", fake_spawn)

    pid = tools_impl._spawn_background(
        ["npm", "run", "dev"], tools_impl.DEV_LOG_FILE, tools_impl.DEV_PID_FILE
    )

    assert pid == 4242
    assert seen["cwd"] == tools_impl.ROOT
    assert seen["log_file"] == tools_impl.DEV_LOG_FILE
    assert seen["pid_file"] == tools_impl.DEV_PID_FILE


@pytest.mark.parametrize(
    ("local_name", "shared"),
    [
        ("_pid_alive", devops.pid_alive),
        ("_kill_pid", devops.kill_pid),
        ("_read_pid", devops.read_pid),
        ("_port_in_use", devops.port_in_use),
        ("_https_ok", devops.https_ok),
    ],
)
def test_helpers_are_the_shared_implementations(local_name: str, shared) -> None:
    # Guards against someone re-inlining a local copy and re-opening #226.
    assert getattr(tools_impl, local_name) is shared


def test_root_points_at_repo_checkout() -> None:
    assert (tools_impl.ROOT / "package.json").is_file()
    assert (tools_impl.ROOT / "scripts" / "tools_impl.py").is_file()


def test_read_pid_roundtrip_through_shim(tmp_path: Path) -> None:
    pid_file = tmp_path / "dev.pid"
    assert tools_impl._read_pid(pid_file) is None
    pid_file.write_text("1234\n", encoding="utf-8")
    assert tools_impl._read_pid(pid_file) == 1234
