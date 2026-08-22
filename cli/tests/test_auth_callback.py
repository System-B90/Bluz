"""
Name: test_auth_callback.py
Purpose: Regression tests for the `bluz login` loopback callback server.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from __future__ import annotations

import http.client
import threading
import time
import urllib.parse
from typing import Any, Callable

import pytest

from bluz_cli.commands import auth


def _drive(
    on_port: Callable[[int, str], None],
) -> tuple[str | None, float]:
    """Runs the callback server with the browser replaced by `on_port`.

    Returns the token it resolved and how long it took, so a test can assert
    the server returns on the callback rather than running out its 60s clock —
    the exact symptom this flow regressed with. `on_port` also receives the
    verification code embedded in the login URL, since the callback now
    requires it (#521).
    """
    started = threading.Event()

    def fake_open(url: str) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        port = int(query["port"][0])
        code = query["code"][0]

        def run() -> None:
            started.set()
            on_port(port, code)

        threading.Thread(target=run, daemon=True).start()

    original = auth.webbrowser.open
    auth.webbrowser.open = fake_open  # type: ignore[assignment]
    try:
        start = time.monotonic()
        token = auth._run_callback_server("https://bluz.dev")
        return token, time.monotonic() - start
    finally:
        auth.webbrowser.open = original  # type: ignore[assignment]


def _get(port: int, path: str, headers: dict[str, str] | None = None) -> Any:
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    conn.request("GET", path, headers=headers or {})
    response = conn.getresponse()
    body = response.read()
    result = (response.status, dict(response.getheaders()), body)
    conn.close()
    return result


NAVIGATION_ACCEPT = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}
FETCH_ACCEPT = {"Accept": "*/*", "Origin": "https://bluz.dev"}


def test_fetch_callback_returns_json_and_token() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, f"/callback?code={code}&token=TOK", FETCH_ACCEPT
        )

    token, elapsed = _drive(call)

    status, headers, body = captured["response"]
    assert token == "TOK"
    assert status == 200
    assert headers["Content-Type"] == "application/json; charset=utf-8"
    assert body == b'{"status":"success"}'
    # The bug this replaces sat out the full 60s timeout.
    assert elapsed < 15


def test_navigation_callback_returns_an_html_page() -> None:
    """A browser navigation must land on a real page, not raw JSON.

    Chrome's Local Network Access check can refuse the page's fetch() to
    127.0.0.1 outright, so the widget falls back to opening the callback URL
    directly — and whatever this server returns is what the user sees.
    """
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, f"/callback?code={code}&token=TOK", NAVIGATION_ACCEPT
        )

    token, _ = _drive(call)

    status, headers, body = captured["response"]
    assert token == "TOK"
    assert status == 200
    assert headers["Content-Type"] == "text/html; charset=utf-8"
    assert body.startswith(b"<!doctype html>")
    assert "ההתחברות הושלמה בהצלחה".encode() in body


def test_navigation_without_a_token_explains_itself_in_html() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, f"/callback?code={code}", NAVIGATION_ACCEPT)
        # Nothing will set the event, so release the wait.
        _get(port, f"/callback?code={code}&token=LATE", FETCH_ACCEPT)

    _drive(call)

    status, headers, body = captured["response"]
    assert status == 400
    assert headers["Content-Type"] == "text/html; charset=utf-8"
    assert "לא התקבל קוד התחברות".encode() in body


def test_fetch_without_a_token_returns_json_error() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, f"/callback?code={code}", FETCH_ACCEPT)
        _get(port, f"/callback?code={code}&token=LATE", FETCH_ACCEPT)

    _drive(call)

    status, headers, body = captured["response"]
    assert status == 400
    assert headers["Content-Type"] == "application/json; charset=utf-8"
    assert body == b'{"status":"error","error":"no_token"}'


def test_empty_token_is_rejected() -> None:
    """`?token=` with no value used to fall through as a truthy list."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, f"/callback?code={code}&token=", FETCH_ACCEPT)
        _get(port, f"/callback?code={code}&token=LATE", FETCH_ACCEPT)

    _drive(call)

    assert captured["response"][0] == 400


def test_missing_code_is_rejected() -> None:
    """No `code` at all must not fall back to accepting the token (#521)."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, "/callback?token=TOK", FETCH_ACCEPT)
        _get(port, f"/callback?code={code}&token=LATE", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert captured["response"][0] == 403
    assert token == "LATE"


def test_wrong_code_is_rejected() -> None:
    """A mismatched code must not be accepted as the pending login (#521)."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, "/callback?code=WRONG-CODE&token=ATTACKER", FETCH_ACCEPT
        )
        _get(port, f"/callback?code={code}&token=LATE", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert captured["response"][0] == 403
    assert token != "ATTACKER"


def test_preflight_opts_into_private_network_access() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        conn.request(
            "OPTIONS",
            "/callback",
            headers={
                "Origin": "https://bluz.dev",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Private-Network": "true",
            },
        )
        response = conn.getresponse()
        captured["status"] = response.status
        captured["headers"] = dict(response.getheaders())
        response.read()
        conn.close()
        _get(port, f"/callback?code={code}&token=TOK", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert token == "TOK"
    assert captured["status"] == 204
    assert captured["headers"]["Access-Control-Allow-Private-Network"] == "true"
    # Scoped to the Bluz origin passed to _run_callback_server, not a
    # wildcard (#521) -- any local page could otherwise read the response.
    assert captured["headers"]["Access-Control-Allow-Origin"] == "https://bluz.dev"


@pytest.mark.parametrize("path", ["/", "/callback", "/anything"])
def test_any_path_carrying_a_token_is_accepted(path: str) -> None:
    """The CLI must not care about the path the page chose."""

    def call(port: int, code: str) -> None:
        _get(port, f"{path}?code={code}&token=TOK", FETCH_ACCEPT)

    token, _ = _drive(call)
    assert token == "TOK"


def test_result_page_is_valid_utf8_html() -> None:
    ok = auth._result_page(ok=True)
    failed = auth._result_page(ok=False)

    for page in (ok, failed):
        assert page.startswith(b"<!doctype html>")
        assert page.decode("utf-8").rstrip().endswith("</html>")
        assert 'lang="he"' in page.decode("utf-8")
        assert 'dir="rtl"' in page.decode("utf-8")

    assert ok != failed
