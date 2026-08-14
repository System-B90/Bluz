"""
Name: context.py
Purpose: Hold the resolved global CLI state (config + output mode) and hand out
         configured BluzClient instances. Keeps command modules decoupled from
         the root app wiring (Dependency Inversion).
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

from dataclasses import dataclass, field

from bluz_cli.client import BluzClient
from bluz_cli.config import Config, load_config


@dataclass
class AppState:
    """Process-wide CLI state, populated by the root Typer callback."""

    config: Config = field(default_factory=Config)
    as_json: bool = False
    quiet: bool = False
    # The values passed explicitly as global flags, kept apart from `config`
    # (which also folds in env vars and the config file). `login` needs the
    # distinction: an explicit `--url` must skip the prompt, a config-file url
    # must only be offered as the prompt's default.
    explicit_url: str | None = None
    explicit_token: str | None = None
    explicit_insecure: bool | None = None

    def client(self) -> BluzClient:
        """Build an authenticated client for the current configuration."""
        return BluzClient(self.config)


# Single shared instance — the root callback fills it before any command runs.
state = AppState()


def configure(
    *,
    url: str | None,
    token: str | None,
    insecure: bool | None,
    as_json: bool,
    quiet: bool = False,
) -> None:
    """Resolve and store global configuration for the running command."""
    state.config = load_config(url=url, token=token, insecure=insecure)
    state.as_json = as_json
    state.quiet = quiet
    state.explicit_url = url
    state.explicit_token = token
    state.explicit_insecure = insecure
