"""
Name: test_sdk_session.py
Purpose: Session management (whoami, require_login, Bluz.login) and the
         plain-text help surfaces (`bz.help()`, `Model.help()`, docstrings).
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import inspect
from datetime import UTC, datetime

import bluz
import pytest
from bluz import Bluz, Curriculum, Event, NotAuthenticatedError
from bluz.config import load_config
from bluz.help import describe, type_name
from bluz.models import Room

SESSION = {
    "user": {"name": "Dana", "email": "dana@example.com", "image": None},
    "expires": "2026-11-01T00:00:00.000Z",
}


# --- whoami / require_login -----------------------------------------------------


def test_whoami_parses_the_next_auth_session(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/auth/session", SESSION)

    info = sdk(stub).whoami()

    assert info.authenticated
    assert info.user.name == "Dana"
    assert info.expires == datetime(2026, 11, 1, tzinfo=UTC)


def test_expired_token_is_an_empty_session_not_an_error(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/auth/session", {})

    bz = sdk(stub)

    assert bz.whoami().authenticated is False
    assert bz.is_authenticated is False


def test_unauthorised_session_probe_is_empty(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/auth/session", {}, status=401)

    assert sdk(stub).whoami().user is None


def test_require_login_fails_fast_with_guidance(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/auth/session", {})

    with pytest.raises(NotAuthenticatedError, match="bluz login"):
        sdk(stub).require_login()


def test_require_login_returns_the_session(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/auth/session", SESSION)

    assert sdk(stub).require_login().user.email == "dana@example.com"


# --- Bluz.login -------------------------------------------------------------------


def test_login_saves_config_and_returns_a_session(stub_bluz, sdk, monkeypatch):
    stub = stub_bluz()
    monkeypatch.setattr(
        "bluz.commands.auth.browser_login", lambda url, insecure: "fresh-token"
    )

    bz = Bluz.login(stub.url, insecure=False)

    assert bz.config.token == "fresh-token"
    saved = load_config()
    assert (saved.url, saved.token) == (stub.url, "fresh-token")
    bz.close()


def test_instance_login_uses_the_session_url_and_refreshes_it(
    stub_bluz, sdk, monkeypatch
):
    stub = stub_bluz()
    seen = []

    def fake_login(url, insecure):
        seen.append(url)
        return "fresh-token"

    monkeypatch.setattr("bluz.commands.auth.browser_login", fake_login)
    bz = Bluz(stub.url, "old-token")

    assert bz.login(save=False) is bz

    assert seen == [stub.url]
    assert bz.url == stub.url
    assert bz.config.token == "fresh-token"
    bz.close()


def test_login_falls_back_to_a_pasted_handoff_code(stub_bluz, sdk, monkeypatch):
    stub = stub_bluz()
    monkeypatch.setattr("bluz.commands.auth.browser_login", lambda url, insecure: None)
    monkeypatch.setattr("getpass.getpass", lambda prompt: "CODE-1")
    redeemed = []

    def redeem(url, code, *, insecure):
        redeemed.append(code)
        return "redeemed-token"

    monkeypatch.setattr("bluz.commands.auth.redeem_handoff_code", redeem)

    bz = Bluz.login(stub.url, save=False)

    assert redeemed == ["CODE-1"]
    assert bz.config.token == "redeemed-token"
    bz.close()


def test_login_with_no_code_is_cancelled(stub_bluz, sdk, monkeypatch):
    stub = stub_bluz()
    monkeypatch.setattr("bluz.commands.auth.browser_login", lambda url, insecure: None)
    monkeypatch.setattr("getpass.getpass", lambda prompt: "")

    with pytest.raises(NotAuthenticatedError, match="cancelled"):
        Bluz.login(stub.url, save=False)


def test_login_needs_a_url(sdk, monkeypatch):
    monkeypatch.delenv("BLUZ_URL", raising=False)
    with pytest.raises(bluz.ConfigError):
        Bluz.login()


# --- help surfaces ----------------------------------------------------------------


def test_session_help_lists_every_namespace(capsys):
    bz = Bluz("http://example.invalid", "t")
    bz.help()
    out = capsys.readouterr().out
    for prefix in ("bz.rooms.list", "bz.gantt.curriculums.cut_plan", "bz.events.list"):
        assert prefix in out
    assert "bz.require_login" in out


def test_namespace_help_uses_the_attribute_path(capsys):
    bz = Bluz("http://example.invalid", "t")
    bz.gantt.modules.help()
    out = capsys.readouterr().out
    assert out.startswith("bz.gantt.modules - ")
    assert "bz.gantt.modules.reorder(item, children) -> None" in out


def test_describe_never_calls_the_server():
    # A bound model with lazy, server-hitting properties: describing it must
    # not touch them (the URL is unreachable, so any request would raise).
    bz = Bluz("http://127.0.0.1:9", "t")
    course = bluz.Course.from_wire({"id": "k", "parentId": "p"}, bz)
    text = describe(course)
    assert ".parent" in text and ".children" in text


def test_model_help_shows_fields_with_wire_names(capsys):
    Event.help()
    out = capsys.readouterr().out
    assert "start_time" in out and "(wire: startTime)" in out
    assert "model_fields_set" not in out


def test_model_docstring_carries_the_field_table():
    doc = inspect.getdoc(Curriculum)
    assert "Fields:" in doc
    assert "start_date" in doc and "date | None" in doc
    assert "c2s" not in doc  # raw junction rows are hidden


def test_help_output_is_plain_ascii_structure():
    text = describe(Bluz("http://example.invalid", "t"))
    assert "\x1b[" not in text  # no ANSI colour codes
    assert all(len(line) <= 100 for line in text.splitlines())


def test_type_name_is_short():
    from datetime import date

    assert type_name(date | None) == "date | None"
    assert type_name(list[Room]) == "list[Room]"
    assert type_name("bluz.models.gantt.Curriculum | None") == "Curriculum | None"
