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
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import tqdm
import typer
from InquirerPy import inquirer

from bluz_cli.config import Config, config_location, load_config
from bluz_cli.output import success, warn

app = typer.Typer(help="Authentication and CLI configuration.", no_args_is_help=True)


class AuthHTTPServer(HTTPServer):
    """Simple HTTP server with a token attribute for CLI callback."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.token: str | None = None


def _run_callback_server(url: str) -> str | None:
    """
    Run a temporary local HTTP server to receive the session token.

    Generates a verification code, opens the browser, and returns the token on success.
    """
    chars = string.ascii_uppercase + string.digits
    part1 = "".join(random.choices(chars, k=4))
    part2 = "".join(random.choices(chars, k=4))
    code = f"{part1}-{part2}"

    class CallbackHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            # Suppress normal HTTP request logging
            pass

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            token_list = params.get("token")
            if token_list:
                self.server.token = token_list[0]  # type: ignore[attr-defined]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"status":"success"}')
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"No token found.")

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
    server.timeout = 0.5

    login_url = f"{url.rstrip('/')}/cli-auth?port={port}&code={code}"

    typer.echo("\n==================================================")
    typer.echo(f"  Authentication Code: {code}")
    typer.echo("==================================================")
    typer.echo(f"Opening browser to: {login_url}\n")

    webbrowser.open(login_url)

    timeout = 60
    start_time = time.time()
    last_elapsed = 0.0

    with tqdm.tqdm(
        total=timeout,
        desc="Waiting for authentication",
        unit="s",
        bar_format="{desc}: |{bar}| {n:.0f}/{total_fmt}s",
    ) as pbar:
        while not server.token and (time.time() - start_time) < timeout:
            server.handle_request()
            elapsed = time.time() - start_time
            if elapsed - last_elapsed >= 1.0:
                pbar.update(int(elapsed - last_elapsed))
                last_elapsed = elapsed

    token = server.token
    server.server_close()
    return token


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

    Grab the session token from your browser's cookies for the Bluz site
    (`__Secure-next-auth.session-token` over HTTPS, `next-auth.session-token`
    over HTTP) and paste it when prompted.
    """
    existing = load_config()

    if not url:
        url = inquirer.text(
            message="Bluz server URL:",
            default=existing.url or "https://",
        ).execute()

    if not token:
        # Try automatic login first
        try:
            token = _run_callback_server(url)
            if token:
                success("Successfully authenticated automatically!")
        except Exception as exc:
            warn(f"Automatic login failed: {exc}")

        # Fallback to manual entry if automatic login did not obtain a token
        if not token:
            token = inquirer.secret(
                message="Session token (leave blank to keep existing):",
            ).execute()
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
