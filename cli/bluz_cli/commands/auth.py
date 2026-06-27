"""
Name: auth.py
Purpose: Login / logout / config commands. Stores the Bluz server URL and the
         next-auth session token used to authenticate every other command.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer
from InquirerPy import inquirer

from bluz_cli.config import Config, config_location, load_config
from bluz_cli.output import success, warn

app = typer.Typer(help="Authentication and CLI configuration.", no_args_is_help=True)


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
    config = load_config()
    masked = "<set>" if config.token else "<none>"
    typer.echo(f"Config file : {config_location()}")
    typer.echo(f"URL         : {config.url or '<none>'}")
    typer.echo(f"Token       : {masked}")
    typer.echo(f"Cookie name : {config.cookie_name}")
    typer.echo(f"Insecure    : {config.insecure}")
