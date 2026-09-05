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
from bluz_cli.errors import BluzApiError


def _drive(
    on_port: Callable[[int, str], None],
    *,
    redeem: Callable[[str, str], str] | None = None,
) -> tuple[str | None, float]:
    """Runs the callback server with the browser replaced by `on_port`.

    Returns the token it resolved and how long it took, so a test can assert
    the server returns on the callback rather than running out its 60s clock —
    the exact symptom this flow regressed with. `on_port` also receives the
    verification code embedded in the login URL, since the callback now
    requires it (#521).

    `redeem` stands in for `_redeem_handoff_code` (the HTTPS round trip that
    exchanges a handoff code for the real session token, #520) so these tests
    never hit the network. Defaults to echoing the handoff code's value back
    with a "redeemed:" prefix, so a test can assert on what the callback
    server received without caring about the real server-side redeem route
    (covered separately by the API route's own unit tests).
    """
    started = threading.Event()
    browser_threads: list[threading.Thread] = []

    def fake_open(url: str) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        port = int(query["port"][0])
        code = query["code"][0]

        def run() -> None:
            started.set()
            on_port(port, code)

        thread = threading.Thread(target=run, daemon=True)
        browser_threads.append(thread)
        thread.start()

    def fake_redeem(url: str, handoff_code: str, *, insecure: bool) -> str:
        return f"redeemed:{handoff_code}"

    original_open = auth.webbrowser.open
    original_redeem = auth._redeem_handoff_code
    auth.webbrowser.open = fake_open  # type: ignore[assignment]
    auth._redeem_handoff_code = redeem or fake_redeem  # type: ignore[assignment]
    try:
        start = time.monotonic()
        token = auth._run_callback_server("https://bluz.dev")
        elapsed = time.monotonic() - start
        # The server records the token *before* writing the response (#660), so
        # `_run_callback_server` can return while the stub browser is still
        # reading it. Join before asserting on what the stub captured.
        for thread in browser_threads:
            thread.join(timeout=10)
        return token, elapsed
    finally:
        auth.webbrowser.open = original_open  # type: ignore[assignment]
        auth._redeem_handoff_code = original_redeem  # type: ignore[assignment]


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


def test_fetch_callback_redeems_the_handoff_code_and_returns_the_token() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, f"/callback?code={code}&handoff=HANDOFF-1", FETCH_ACCEPT
        )

    token, elapsed = _drive(call)

    status, headers, body = captured["response"]
    # The callback never received a session token directly (#520) -- it
    # received a handoff code and redeemed it for the token itself.
    assert token == "redeemed:HANDOFF-1"
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
            port, f"/callback?code={code}&handoff=HANDOFF-1", NAVIGATION_ACCEPT
        )

    token, _ = _drive(call)

    status, headers, body = captured["response"]
    assert token == "redeemed:HANDOFF-1"
    assert status == 200
    assert headers["Content-Type"] == "text/html; charset=utf-8"
    assert body.startswith(b"<!doctype html>")
    assert "ההתחברות הושלמה בהצלחה".encode() in body


def test_navigation_without_a_handoff_code_explains_itself_in_html() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, f"/callback?code={code}", NAVIGATION_ACCEPT)
        # Nothing will set the event, so release the wait.
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    _drive(call)

    status, headers, body = captured["response"]
    assert status == 400
    assert headers["Content-Type"] == "text/html; charset=utf-8"
    assert "לא התקבל קוד התחברות".encode() in body


def test_fetch_without_a_handoff_code_returns_json_error() -> None:
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, f"/callback?code={code}", FETCH_ACCEPT)
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    _drive(call)

    status, headers, body = captured["response"]
    assert status == 400
    assert headers["Content-Type"] == "application/json; charset=utf-8"
    assert body == b'{"status":"error","error":"no_handoff_code"}'


def test_empty_handoff_code_is_rejected() -> None:
    """`?handoff=` with no value used to fall through as a truthy list."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, f"/callback?code={code}&handoff=", FETCH_ACCEPT
        )
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    _drive(call)

    assert captured["response"][0] == 400


def test_missing_code_is_rejected() -> None:
    """No `code` at all must not fall back to accepting the handoff (#521)."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(port, "/callback?handoff=ATTACKER", FETCH_ACCEPT)
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert captured["response"][0] == 403
    assert token == "redeemed:LATE"


def test_wrong_code_is_rejected() -> None:
    """A mismatched code must not be accepted as the pending login (#521)."""
    captured: dict[str, Any] = {}

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, "/callback?code=WRONG-CODE&handoff=ATTACKER", FETCH_ACCEPT
        )
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert captured["response"][0] == 403
    assert token != "redeemed:ATTACKER"


def test_redeem_failure_does_not_complete_the_login() -> None:
    """A handoff code the server rejects (expired/already used/unknown) must
    not silently complete the login (#520)."""
    captured: dict[str, Any] = {}

    def failing_redeem(url: str, handoff_code: str, *, insecure: bool) -> str:
        if handoff_code == "BAD":
            raise BluzApiError("ClientApiError", "Invalid or already-used code.")
        return f"redeemed:{handoff_code}"

    def call(port: int, code: str) -> None:
        captured["response"] = _get(
            port, f"/callback?code={code}&handoff=BAD", FETCH_ACCEPT
        )
        # The failed attempt above must not have set token_received; release
        # the wait with a follow-up request instead of running out the full
        # 60s clock (the failing_redeem stub below only rejects "BAD").
        _get(port, f"/callback?code={code}&handoff=LATE", FETCH_ACCEPT)

    token, _ = _drive(call, redeem=failing_redeem)

    status, _, body = captured["response"]
    assert status == 400
    assert body == b'{"status":"error","error":"redeem_failed"}'
    # The rejected "BAD" code never completed the login -- only the
    # follow-up request's code did.
    assert token == "redeemed:LATE"


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
        _get(port, f"/callback?code={code}&handoff=HANDOFF-1", FETCH_ACCEPT)

    token, _ = _drive(call)

    assert token == "redeemed:HANDOFF-1"
    assert captured["status"] == 204
    assert captured["headers"]["Access-Control-Allow-Private-Network"] == "true"
    # Scoped to the Bluz origin passed to _run_callback_server, not a
    # wildcard (#521) -- any local page could otherwise read the response.
    assert captured["headers"]["Access-Control-Allow-Origin"] == "https://bluz.dev"


@pytest.mark.parametrize("path", ["/", "/callback", "/anything"])
def test_any_path_carrying_a_handoff_code_is_accepted(path: str) -> None:
    """The CLI must not care about the path the page chose."""

    def call(port: int, code: str) -> None:
        _get(port, f"{path}?code={code}&handoff=HANDOFF-1", FETCH_ACCEPT)

    token, _ = _drive(call)
    assert token == "redeemed:HANDOFF-1"


def test_result_page_is_valid_utf8_html() -> None:
    ok = auth._result_page(ok=True)
    failed = auth._result_page(ok=False)

    for page in (ok, failed):
        assert page.startswith(b"<!doctype html>")
        assert page.decode("utf-8").rstrip().endswith("</html>")
        assert 'lang="he"' in page.decode("utf-8")
        assert 'dir="rtl"' in page.decode("utf-8")

    assert ok != failed


def test_the_same_handoff_code_can_be_delivered_twice() -> None:
    """The page routinely delivers one handoff code twice (#660).

    Its fetch() is aborted -- by its own timeout, or by Chrome refusing to let
    an HTTPS page read a 127.0.0.1 response -- *after* this server already
    redeemed the code, and it then falls back to a plain navigation carrying
    that same code. Handoff codes are single-use server-side, so re-redeeming
    fails; the second delivery must replay the first result instead, or the
    user is shown "לא התקבל קוד התחברות" for a login that actually succeeded.
    """
    captured: dict[str, Any] = {}
    redeemed: list[str] = []

    def single_use_redeem(url: str, handoff_code: str, *, insecure: bool) -> str:
        if handoff_code in redeemed:
            raise BluzApiError("ClientApiError", "Invalid or already-used code.")
        redeemed.append(handoff_code)
        return f"redeemed:{handoff_code}"

    def call(port: int, code: str) -> None:
        path = f"/callback?code={code}&handoff=HANDOFF-1"
        captured["fetch"] = _get(port, path, FETCH_ACCEPT)
        captured["navigation"] = _get(port, path, NAVIGATION_ACCEPT)

    token, _ = _drive(call, redeem=single_use_redeem)

    assert token == "redeemed:HANDOFF-1"
    # The server exchanged the code exactly once.
    assert redeemed == ["HANDOFF-1"]
    assert captured["fetch"][0] == 200
    # The repeat navigation lands on the success page, not the failure page.
    status, headers, body = captured["navigation"]
    assert status == 200
    assert headers["Content-Type"] == "text/html; charset=utf-8"
    assert "ההתחברות הושלמה בהצלחה".encode() in body


def test_a_dead_socket_does_not_lose_a_completed_login() -> None:
    """The browser can abandon the connection mid-response.

    The result is recorded before the response is written, so a socket the
    client already closed cannot cost the CLI a login it has already
    completed (#660).
    """

    def call(port: int, code: str) -> None:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        conn.request(
            "GET", f"/callback?code={code}&handoff=HANDOFF-1", headers=FETCH_ACCEPT
        )
        # Walk away without reading the response, exactly as an aborted
        # fetch() does. The brief wait is what makes this deterministic:
        # closing the instant after `request()` can reset the connection
        # before the server has read it at all, which tests nothing.
        time.sleep(0.5)
        conn.close()

    token, elapsed = _drive(call)

    assert token == "redeemed:HANDOFF-1"
    # Returned on the callback rather than running out the 60s clock.
    assert elapsed < 15
