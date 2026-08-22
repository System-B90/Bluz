"""
Name: auth.py
Purpose: Login / logout / config commands. Stores the Bluz server URL and the
         next-auth session token used to authenticate every other command.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import random
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
from bluz_cli.config import Config, config_location, load_config
from bluz_cli.context import state
from bluz_cli.errors import BluzApiError
from bluz_cli.output import success, warn

app = typer.Typer(help="Authentication and CLI configuration.", no_args_is_help=True)


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

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.token: str | None = None
        self.token_received = threading.Event()


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
            self.end_headers()
            self.wfile.write(body)

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

            # Redeem the handoff code for the real session token over HTTPS.
            # The browser never sent us the token itself (#520).
            try:
                token = _redeem_handoff_code(url, handoff_list[0], insecure=insecure)
            except Exception:
                self._respond(
                    400,
                    json_body=b'{"status":"error","error":"redeem_failed"}',
                    html_body=_result_page(ok=False),
                )
                return

            self.server.token = token  # type: ignore[attr-defined]
            self._respond(
                200,
                json_body=b'{"status":"success"}',
                html_body=_result_page(ok=True),
            )
            self.server.token_received.set()  # type: ignore[attr-defined]

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
        server.shutdown()
        serve_thread.join(timeout=5)
        server.server_close()

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
        except Exception as exc:
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
                except Exception as exc:
                    warn(f"Could not redeem handoff code: {exc}")
            if not token:
                token = existing.token

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
    config = load_config()
    config.token = None
    config.save()
    success("Logged out — session token cleared.")


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
