"""
Name: auth.py
Purpose: Login / logout / config commands. Stores the Bluz server URL and the
         next-auth session token used to authenticate every other command.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import os
import random
import socket
import string
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import httpx
import tqdm
import typer
from InquirerPy import inquirer

from bluz_cli.client import BluzClient
from bluz_cli.config import (
    ENV_TOKEN,
    Config,
    _load_file,
    config_location,
    load_config,
)
from bluz_cli.context import state
from bluz_cli.errors import BluzApiError
from bluz_cli.output import success, warn

app = typer.Typer(help="Authentication and CLI configuration.", no_args_is_help=True)

# How long the callback server keeps listening after the login has succeeded,
# so a browser navigation that repeats the handoff code still lands on the
# success page rather than a connection error (#660).
#
# Sized for a human, not a round trip: popup blockers mean the browser cannot
# hand off on its own, so the user has to notice the "השלם התחברות" button and
# click it. The wait costs the user nothing -- it runs on a daemon thread while
# `login` gets on with its remaining prompts (see `_run_callback_server`) -- so
# it is set generously rather than trimmed.
POST_SUCCESS_GRACE_SECONDS = 30.0


class AuthHTTPServer(ThreadingHTTPServer):
    """
    Callback HTTP server for the CLI login handshake.

    Threading matters here: Chrome routinely opens speculative pre-connect
    sockets that send no bytes. A single-threaded server blocks inside the
    handler reading from such a socket and never accepts the real callback
    connection, which is what made `bluz login` sit out the full 60s timeout
    even after the browser reported success.
    """

    daemon_threads = True

    # The port scan below means "give me a port nobody is serving on", and
    # SO_REUSEADDR breaks exactly that: a second `bluz login` started while a
    # previous server is still in its post-success grace window binds the same
    # port successfully, and the two then race for the browser's callback. With
    # reuse off, an occupied port raises OSError and the scan moves on (#660).
    allow_reuse_address = False

    def server_bind(self) -> None:
        """Claim the port exclusively before binding.

        Clearing `allow_reuse_address` is not enough on Windows: without
        SO_EXCLUSIVEADDRUSE a second bind to a port another socket is already
        listening on can still succeed, and the two servers then split the
        incoming callbacks between them at random -- which is precisely the
        ambiguity the port scan exists to avoid (#660).
        """
        exclusive = getattr(socket, "SO_EXCLUSIVEADDRUSE", None)
        if exclusive is not None:
            self.socket.setsockopt(socket.SOL_SOCKET, exclusive, 1)
        super().server_bind()

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.token: str | None = None
        self.token_received = threading.Event()
        # Handoff codes already exchanged for a token, so a repeat callback
        # carrying the same code is answered from here instead of re-redeeming
        # it (#660). Handoff codes are strictly single-use server-side, so
        # without this the second delivery of the *same* login always fails.
        self.redeemed: dict[str, str] = {}
        self.redeemed_lock = threading.Lock()


_RESULT_PAGE = """<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  body {{
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: #0f1115; color: #e6e6e6;
    font-family: Segoe UI, system-ui, -apple-system, sans-serif;
  }}
  .card {{
    max-width: 26rem; padding: 2.5rem; border-radius: 1rem; text-align: center;
    background: #171a21; border: 1px solid rgba(255,255,255,.08);
  }}
  .mark {{ font-size: 3rem; line-height: 1; color: {colour}; }}
  h1 {{ font-size: 1.25rem; margin: 1rem 0 .5rem; }}
  p {{ margin: 0; color: #9aa3b2; font-size: .95rem; }}
</style>
</head>
<body>
  <div class="card">
    <div class="mark">{mark}</div>
    <h1>{heading}</h1>
    <p>{detail}</p>
  </div>
</body>
</html>
"""


def _result_page(*, ok: bool) -> bytes:
    """The page a browser *navigation* to the callback lands on.

    The widget's fetch() gets JSON and the user never leaves the Bluz tab. When
    that fetch is blocked -- Chrome's Local Network Access check can refuse an
    HTTPS page reaching 127.0.0.1 regardless of what this server sends back --
    the page falls back to opening the callback URL directly, and the user ends
    up looking at this.
    """
    if ok:
        body = _RESULT_PAGE.format(
            title="ההתחברות הושלמה",
            colour="#4ade80",
            mark="&check;",
            heading="ההתחברות הושלמה בהצלחה",
            detail="ניתן לסגור לשונית זו ולחזור למסוף.",
        )
    else:
        body = _RESULT_PAGE.format(
            title="ההתחברות נכשלה",
            colour="#f87171",
            mark="&times;",
            heading="לא התקבל קוד התחברות",
            detail="חזור למסוף והדבק את הקוד באופן ידני.",
        )
    return body.encode("utf-8")


def _redeem_handoff_code(url: str, handoff_code: str, *, insecure: bool) -> str:
    """
    Exchange a single-use CLI login handoff code for the session token it was
    minted for (#520), over HTTPS -- POST /api/cli-auth/redeem.

    The browser never hands this process the raw session token: only this
    opaque, short-TTL code, which the server deletes on first redemption.
    Raises `BluzApiError` on an unknown/already-used/expired code or a
    network failure.
    """
    with httpx.Client(
        base_url=url.rstrip("/"), verify=not insecure, timeout=10.0
    ) as http:
        try:
            response = http.post("/api/cli-auth/redeem", json={"code": handoff_code})
        except httpx.RequestError as exc:
            raise BluzApiError("NetworkError", str(exc)) from exc
    data = BluzClient._unwrap(response)
    token = data.get("token") if isinstance(data, dict) else None
    if not token:
        raise BluzApiError("InvalidResponse", "Redeem response carried no token.")
    return token


def _shutdown_server(server: AuthHTTPServer, serve_thread: threading.Thread) -> None:
    """Stop the callback server and release its socket."""
    server.shutdown()
    serve_thread.join(timeout=5)
    server.server_close()


def _shutdown_after_grace(
    server: AuthHTTPServer, serve_thread: threading.Thread
) -> None:
    """Keep answering the callback for the grace window, then shut down.

    Runs on a daemon thread so a login that has already produced its token does
    not make the user wait for the window to expire (#660).
    """
    time.sleep(POST_SUCCESS_GRACE_SECONDS)
    _shutdown_server(server, serve_thread)


def _run_callback_server(url: str, *, insecure: bool = False) -> str | None:
    """
    Run a temporary local HTTP server to receive the CLI login handoff code
    and redeem it for the session token.

    Generates a verification code, opens the browser, and returns the token on success.
    """
    chars = string.ascii_uppercase + string.digits
    part1 = "".join(random.choices(chars, k=4))
    part2 = "".join(random.choices(chars, k=4))
    code = f"{part1}-{part2}"
    allowed_origin = (
        f"{urllib.parse.urlparse(url).scheme}://{urllib.parse.urlparse(url).netloc}"
    )

    class CallbackHandler(BaseHTTPRequestHandler):
        # Bound the read on an idle connection so a stray socket cannot hold a
        # worker thread (and the login) open indefinitely.
        timeout = 5

        def log_message(self, format: str, *args: Any) -> None:
            # Suppress normal HTTP request logging
            pass

        def _send_cors_headers(self) -> None:
            # Scoped to the Bluz origin the user is logging into -- a wildcard
            # here would let any local page (or process able to reach
            # 127.0.0.1) read the callback response (#521).
            self.send_header("Access-Control-Allow-Origin", allowed_origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            # Legacy Private Network Access opt-in. Chrome has replaced the
            # header-based opt-in with a permission-gated Local Network Access
            # check, so a fetch() from the HTTPS page can fail no matter what
            # we send back -- which is why the page also offers a plain
            # navigation to this server (see _wants_html below). Kept because
            # it still satisfies browsers on the older behaviour.
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")

        def _wants_html(self) -> bool:
            """True when this is a browser navigation rather than a fetch().

            A navigation sends `Accept: text/html,...`; fetch() defaults to
            `*/*`. Navigations are not subject to CORS or Local Network Access,
            so they are the path that always works -- but they land the user on
            this server's response, so it has to be a real page.
            """
            return "text/html" in self.headers.get("Accept", "")

        def _respond(self, status: int, *, json_body: bytes, html_body: bytes) -> None:
            html = self._wants_html()
            self.send_response(status)
            self._send_cors_headers()
            self.send_header(
                "Content-Type",
                "text/html; charset=utf-8"
                if html
                else "application/json; charset=utf-8",
            )
            body = html_body if html else json_body
            self.send_header("Content-Length", str(len(body)))
            try:
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                # The page's fetch() aborts on its own timeout, which closes
                # this socket mid-response. The login itself is already decided
                # by the time we get here, so a dead socket is not a failure --
                # swallowing it keeps the handler from unwinding past the code
                # that reports the result (#660).
                pass

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            # The verification code must match the one this process generated
            # and printed/embedded in the login URL. Without this check any
            # local process able to reach 127.0.0.1:<port> during the login
            # window could POST its own token and have it silently accepted
            # (#521).
            code_list = params.get("code")
            if not code_list or code_list[0] != code:
                self._respond(
                    403,
                    json_body=b'{"status":"error","error":"code_mismatch"}',
                    html_body=_result_page(ok=False),
                )
                return

            handoff_list = params.get("handoff")
            if not handoff_list or not handoff_list[0]:
                self._respond(
                    400,
                    json_body=b'{"status":"error","error":"no_handoff_code"}',
                    html_body=_result_page(ok=False),
                )
                return

            handoff_code = handoff_list[0]
            server: AuthHTTPServer = self.server  # type: ignore[assignment]

            # The same handoff code routinely arrives twice: the page's fetch()
            # is aborted (its own 3s timeout, or Chrome's Local Network Access
            # check killing the response) *after* this server already redeemed
            # it, and the page then falls back to a plain navigation carrying
            # that same code. Redeeming is single-use server-side, so the
            # second delivery used to fail and land the user on "לא התקבל קוד
            # התחברות" even though the login had in fact succeeded (#660).
            # Replaying the first result makes the callback idempotent.
            # The lock is held across the whole check-redeem-store, not just
            # around the dict: the two deliveries of one code routinely overlap,
            # and a lock that only guards the lookup lets both threads miss the
            # cache, both call out, and the loser get "already-used" back --
            # exactly the failure this cache exists to prevent. Serializing
            # costs nothing here; a login produces a couple of requests, not
            # concurrent traffic.
            with server.redeemed_lock:
                token = server.redeemed.get(handoff_code)
                if token is None:
                    # Redeem the handoff code for the real session token over
                    # HTTPS. The browser never sent us the token itself (#520).
                    try:
                        token = _redeem_handoff_code(
                            url, handoff_code, insecure=insecure
                        )
                    except BluzApiError:
                        self._respond(
                            400,
                            json_body=b'{"status":"error","error":"redeem_failed"}',
                            html_body=_result_page(ok=False),
                        )
                        return
                    server.redeemed[handoff_code] = token

            # Record the result *before* answering: writing the response can
            # fail on a socket the browser already abandoned, and the login
            # must not be lost to that (#660).
            server.token = token
            server.token_received.set()
            self._respond(
                200,
                json_body=b'{"status":"success"}',
                html_body=_result_page(ok=True),
            )

    server = None
    for p in range(52400, 52411):
        try:
            server = AuthHTTPServer(("127.0.0.1", p), CallbackHandler)
            port = p
            break
        except OSError:
            continue
    if server is None:
        try:
            server = AuthHTTPServer(("127.0.0.1", 0), CallbackHandler)
            port = server.server_address[1]
        except OSError as exc:
            typer.echo(f"Could not start local server for auto-login: {exc}")
            return None
    login_url = f"{url.rstrip('/')}/cli-auth?port={port}&code={code}"

    typer.echo("\n==================================================")
    typer.echo(f"  Authentication Code: {code}")
    typer.echo("==================================================")
    typer.echo(f"Opening browser to: {login_url}\n")

    webbrowser.open(login_url)

    timeout = 60
    start_time = time.time()
    last_elapsed = 0.0

    serve_thread = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.1}
    )
    serve_thread.daemon = True
    serve_thread.start()

    try:
        with tqdm.tqdm(
            total=timeout,
            desc="Waiting for authentication",
            unit="s",
            bar_format="{desc}: |{bar}| {n:.0f}/{total_fmt}s",
        ) as pbar:
            # Wait in short slices so the bar keeps moving, but return the
            # instant the callback lands instead of running out the clock.
            while not server.token_received.is_set():
                elapsed = time.time() - start_time
                if elapsed >= timeout:
                    break
                server.token_received.wait(min(0.2, timeout - elapsed))
                elapsed = time.time() - start_time
                if elapsed - last_elapsed >= 1.0:
                    pbar.update(int(elapsed - last_elapsed))
                    last_elapsed = elapsed
    finally:
        # Keep serving for a while after succeeding. The page may still be
        # about to deliver the same handoff code by navigation -- its fetch()
        # having been aborted or blocked, leaving the user to click "השלם
        # התחברות" -- and with the server already gone that navigation lands on
        # a connection error instead of the success page. The callback is
        # idempotent, so the late arrival costs nothing (#660).
        #
        # Torn down from a daemon thread rather than by sleeping here: blocking
        # the caller would add the full grace period to every successful login,
        # and the user has prompts left to answer. Both threads are daemons, so
        # whichever way `login` ends they never hold the process open.
        if server.token_received.is_set():
            threading.Thread(
                target=_shutdown_after_grace,
                args=(server, serve_thread),
                daemon=True,
            ).start()
        else:
            _shutdown_server(server, serve_thread)

    return server.token


@app.command()
def login(
    url: str = typer.Option(
        None, "--url", help="Bluz base URL, e.g. https://bluz.example.com."
    ),
    token: str = typer.Option(
        None, "--token", help="next-auth session token (skips the prompt)."
    ),
    insecure: bool = typer.Option(
        None, "--insecure/--secure", help="Skip TLS verification (self-signed certs)."
    ),
) -> None:
    """
    Store credentials interactively.

    In the browser tab `bluz login` opens, either let it hand off
    automatically or copy the handoff code it shows and paste it here -- the
    CLI exchanges it for the real session token itself (#520). `--token`
    still accepts a raw session token directly (e.g. lifted from browser
    dev-tools) but is deprecated: it is visible in process listings, so
    BLUZ_TOKEN or the handoff flow above are the safe channels.
    """
    existing = load_config()

    # `bluz --url X login` binds --url/--token/--insecure to the *root*
    # callback (they are reordered to the front of argv so they work in any
    # position), leaving this command's own options None. Fall back to what the
    # root actually resolved so the flags are not silently dropped here (#433).
    url = url or state.explicit_url
    token = token or state.explicit_token
    if insecure is None:
        insecure = state.explicit_insecure

    if not url:
        url = inquirer.text(
            message="Bluz server URL:",
            default=existing.url or "https://",
        ).execute()

    if not token:
        # Try automatic login first
        try:
            token = _run_callback_server(url, insecure=bool(insecure))
            if token:
                success("Successfully authenticated automatically!")
        # Deliberately broad: whatever stops the browser flow (a busy port, no
        # browser, a failed redeem), the answer is the manual prompt below.
        except Exception as exc:  # noqa: BLE001
            warn(f"Automatic login failed: {exc}")

        # Fallback to manual entry if automatic login did not obtain a token.
        # What's pasted here is the handoff code shown in the browser tab,
        # not the raw session token -- it still has to be redeemed (#520).
        if not token:
            handoff_code = inquirer.secret(
                message="Handoff code (leave blank to keep existing):",
            ).execute()
            if handoff_code:
                try:
                    token = _redeem_handoff_code(
                        url, handoff_code, insecure=bool(insecure)
                    )
                except BluzApiError as exc:
                    warn(f"Could not redeem handoff code: {exc}")
            if not token:
                # Keep only what the config *file* holds. `existing.token` may
                # come from BLUZ_TOKEN (env / cwd .env) and must not be copied
                # into the user config file.
                token = _load_file().get("token")

    if insecure is None:
        insecure = inquirer.confirm(
            message="Skip TLS verification (self-signed cert)?",
            default=existing.insecure,
        ).execute()

    config = Config(url=url.rstrip("/"), token=token, insecure=insecure)
    if not config.token:
        warn("No token stored — authenticated commands will fail until you set one.")
    path = config.save()
    success(f"Saved configuration to {path}")


@app.command()
def logout() -> None:
    """Forget the stored session token (keeps the server URL)."""
    # Work from the file alone: `load_config()` merges BLUZ_* from the env and
    # cwd .env, and saving that back would persist env-derived values.
    file_data = _load_file()
    config = Config(
        url=file_data.get("url"),
        token=None,
        insecure=bool(file_data.get("insecure", False)),
    )
    config.save()
    success("Logged out — session token cleared.")
    if os.getenv(ENV_TOKEN):
        warn(
            f"{ENV_TOKEN} is set in the environment (or a cwd .env) and still "
            "authenticates; unset it to fully log out."
        )


@app.command("config")
def show_config() -> None:
    """Show the resolved configuration (token is masked)."""
    from bluz_cli.commands._common import show

    config = load_config()
    data = {
        "configFile": str(config_location()),
        "url": config.url,
        "token": "<set>" if config.token else None,
        "cookieName": config.cookie_name,
        "insecure": config.insecure,
    }
    show(data, title="Config")


@app.command("hive-status")
def hive_status() -> None:
    """Check whether the server can reach Hive (drives the SSO outage banner)."""
    from bluz_cli.commands._common import show

    with state.client() as client:
        show(client.get("/api/auth/hive-status"), title="Hive status")


@app.command("ws-ticket")
def ws_ticket() -> None:
    """Mint a session-server WebSocket ticket for the stored credential.

    The ticket is signed with the caller's clearance (`segel` for staff,
    `hanich` for a student), which is what the session server gates on — a
    client cannot widen its own scope. Useful for driving or debugging the
    real-time sync channel outside a browser.
    """
    from bluz_cli.commands._common import show

    with state.client() as client:
        # Not client.get: /api/ws-ticket answers a bare { ticket } rather than
        # the response envelope.
        show(client.get_raw("/api/ws-ticket"), title="WebSocket ticket")
