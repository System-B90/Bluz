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


def test_logout_does_not_persist_an_env_token_and_warns(tmp_path, monkeypatch):
    _isolate_config(tmp_path, monkeypatch)
    Config(url="https://bluz.example.com", token="file-token").save()
    monkeypatch.setenv("BLUZ_TOKEN", "env-token")
    monkeypatch.setenv("BLUZ_URL", "https://other.example.com")

    from typer.testing import CliRunner

    from bluz_cli.config import _load_file
    from bluz_cli.main import app

    result = CliRunner().invoke(app, ["auth", "logout"], catch_exceptions=False)

    assert result.exit_code == 0
    file_data = _load_file()
    # Only the file token is cleared; env-derived values never reach the file.
    assert file_data["token"] is None
    assert file_data["url"] == "https://bluz.example.com"
    assert "BLUZ_TOKEN" in result.output


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


def test_login_redeems_a_pasted_handoff_code_when_automatic_login_fails(
    tmp_path, monkeypatch
):
    """Automatic callback fails -> the CLI falls back to a pasted handoff code,
    which it redeems for the real session token (#520)."""
    _isolate_config(tmp_path, monkeypatch)

    from typer.testing import CliRunner

    from bluz_cli.commands import auth
    from bluz_cli.main import app

    # The loopback server yields nothing.
    monkeypatch.setattr(auth, "_run_callback_server", lambda url, **kw: None)
    prompted = {}
    redeemed = {}

    def fake_secret(**kwargs):
        prompted["message"] = kwargs.get("message")
        return _FixedPrompt("handoff-code")

    def fake_redeem(url, code, **kwargs):
        redeemed["url"] = url
        redeemed["code"] = code
        return "pasted-token"

    monkeypatch.setattr(auth, "_redeem_handoff_code", fake_redeem)
    monkeypatch.setattr(auth.inquirer, "secret", fake_secret)
    monkeypatch.setattr(auth.inquirer, "confirm", lambda **kw: _FixedPrompt(False))

    result = CliRunner().invoke(
        app,
        ["auth", "login", "--url", "https://bluz.example.com"],
        catch_exceptions=False,
    )

    assert result.exit_code == 0
    assert "Handoff code" in prompted["message"]
    assert redeemed["code"] == "handoff-code"
    reloaded = load_config()
    assert reloaded.url == "https://bluz.example.com"
    assert reloaded.token == "pasted-token"
