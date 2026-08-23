"""
Name: test_auth_commands.py
Purpose: Wire contracts and behaviour of the auth family — `hive-status` on the
         wire, plus the offline `logout`, `config`, and login's manual-paste
         fallback branch. The loopback callback handshake itself is covered by
         test_auth_callback.py.
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json

from bluz_cli.config import Config, load_config


def _json_out(result):
    return json.loads(result.stdout)


def _isolate_config(tmp_path, monkeypatch):
    """Same env redirect run_cli uses, for tests that manage config directly."""
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.delenv("BLUZ_URL", raising=False)
    monkeypatch.delenv("BLUZ_TOKEN", raising=False)
    monkeypatch.delenv("BLUZ_INSECURE", raising=False)


# --- bluz auth hive-status -------------------------------------------------------


def test_hive_status_reads_the_auth_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/auth/hive-status", {"reachable": True})

    result = run_cli(stub, "auth", "hive-status")

    assert result.exit_code == 0
    assert stub.last().method == "GET"
    assert stub.last().path == "/api/auth/hive-status"


# --- bluz logout ------------------------------------------------------------------


def test_logout_clears_the_token_but_keeps_the_url(tmp_path, monkeypatch):
    _isolate_config(tmp_path, monkeypatch)
    Config(url="https://bluz.example.com", token="secret-token").save()

    from typer.testing import CliRunner

    from bluz_cli.main import app

    result = CliRunner().invoke(
        app, ["--json", "auth", "logout"], catch_exceptions=False
    )

    assert result.exit_code == 0
    reloaded = load_config()
    assert reloaded.token is None
    assert reloaded.url == "https://bluz.example.com"


# --- bluz auth config --------------------------------------------------------------


def test_config_masks_the_token_and_names_the_file(tmp_path, monkeypatch):
    _isolate_config(tmp_path, monkeypatch)
    saved = Config(url="https://bluz.example.com", token="secret-token").save()

    from typer.testing import CliRunner

    from bluz_cli.main import app

    result = CliRunner().invoke(
        app, ["--json", "auth", "config"], catch_exceptions=False
    )

    assert result.exit_code == 0
    shown = _json_out(result)
    assert shown["configFile"] == str(saved)
    assert shown["url"] == "https://bluz.example.com"
    # The token must never be echoed back in clear text.
    assert shown["token"] == "<set>"
    assert "secret-token" not in result.stdout


def test_config_reports_an_unset_token_as_null(tmp_path, monkeypatch):
    _isolate_config(tmp_path, monkeypatch)

    from typer.testing import CliRunner

    from bluz_cli.main import app

    result = CliRunner().invoke(
        app, ["--json", "auth", "config"], catch_exceptions=False
    )

    assert result.exit_code == 0
    assert _json_out(result)["token"] is None


# --- bluz login: the manual paste fallback -------------------------------------------


class _FixedPrompt:
    """InquirerPy stand-in answering a canned value."""

    def __init__(self, value) -> None:
        self._value = value

    def execute(self):
        return self._value


def test_login_saves_a_pasted_token_when_automatic_login_fails(tmp_path, monkeypatch):
    """Automatic callback fails -> the CLI falls back to a pasted secret."""
    _isolate_config(tmp_path, monkeypatch)

    from typer.testing import CliRunner

    from bluz_cli.commands import auth
    from bluz_cli.main import app

    # The loopback server yields nothing.
    monkeypatch.setattr(auth, "_run_callback_server", lambda url: None)
    prompted = {}

    def fake_secret(**kwargs):
        prompted["message"] = kwargs.get("message")
        return _FixedPrompt("pasted-token")

    monkeypatch.setattr(auth.inquirer, "secret", fake_secret)
    monkeypatch.setattr(auth.inquirer, "confirm", lambda **kw: _FixedPrompt(False))

    result = CliRunner().invoke(
        app,
        ["auth", "login", "--url", "https://bluz.example.com"],
        catch_exceptions=False,
    )

    assert result.exit_code == 0
    assert "Session token" in prompted["message"]
    reloaded = load_config()
    assert reloaded.url == "https://bluz.example.com"
    assert reloaded.token == "pasted-token"
