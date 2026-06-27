"""
Name: config.py
Purpose: Load, persist, and resolve CLI configuration (server URL + auth token).
         Values resolve in order: explicit CLI flags > environment > config file.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

import typer
from dotenv import load_dotenv

from bluz_cli.errors import ConfigError

# Bluz authenticates browser requests with a next-auth session cookie. Over HTTPS
# next-auth uses the "__Secure-" prefixed cookie; over plain HTTP it does not.
SECURE_COOKIE_NAME = "__Secure-next-auth.session-token"
INSECURE_COOKIE_NAME = "next-auth.session-token"

ENV_URL = "BLUZ_URL"
ENV_TOKEN = "BLUZ_TOKEN"
ENV_INSECURE = "BLUZ_INSECURE"

_CONFIG_FILE_NAME = "config.json"


def _config_dir() -> Path:
    """Cross-platform per-user config directory for the CLI."""
    return Path(typer.get_app_dir("bluz"))


def _config_path() -> Path:
    return _config_dir() / _CONFIG_FILE_NAME


def _as_bool(value: str | bool | None) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Config:
    """Resolved CLI configuration."""

    url: str | None = None
    token: str | None = None
    insecure: bool = False

    @property
    def cookie_name(self) -> str:
        """Pick the next-auth cookie name that matches the server scheme."""
        url = (self.url or "").lower()
        return INSECURE_COOKIE_NAME if url.startswith("http://") else SECURE_COOKIE_NAME

    def require_url(self) -> str:
        if not self.url:
            raise ConfigError(
                "No Bluz server URL configured. Run `bluz login` or pass --url / set BLUZ_URL."
            )
        return self.url.rstrip("/")

    def save(self) -> Path:
        """Persist config to disk, creating the directory if needed."""
        path = _config_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(asdict(self), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        # Tokens are sensitive: tighten permissions where the OS supports it.
        try:
            path.chmod(0o600)
        except OSError:
            pass
        return path


def _load_file() -> dict:
    path = _config_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise ConfigError(f"Could not read config file {path}: {exc}") from exc


def load_config(
    *,
    url: str | None = None,
    token: str | None = None,
    insecure: bool | None = None,
) -> Config:
    """
    Build the effective configuration. Precedence: explicit args > env > file.

    A local .env (cwd) is loaded first so `BLUZ_*` vars there are honoured, matching
    how the rest of the Bluz tooling reads configuration.
    """
    load_dotenv(override=False)
    file_data = _load_file()

    resolved_url = url or os.getenv(ENV_URL) or file_data.get("url")
    resolved_token = token or os.getenv(ENV_TOKEN) or file_data.get("token")

    if insecure is not None:
        resolved_insecure = insecure
    elif os.getenv(ENV_INSECURE) is not None:
        resolved_insecure = _as_bool(os.getenv(ENV_INSECURE))
    else:
        resolved_insecure = bool(file_data.get("insecure", False))

    return Config(
        url=resolved_url,
        token=resolved_token,
        insecure=resolved_insecure,
    )


def config_location() -> Path:
    """Public accessor for the config file path (used by `bluz config`)."""
    return _config_path()
