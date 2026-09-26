"""
Name: setup.py
Purpose: Interactive wizard that writes Bluz's .env, issues TLS certificates and
    registers Bluz as a Hive SSO application.
Created: 2026-04-11
Author: Michael K. Steinberg

The shared parts — keeping existing secrets and foreign keys, the domain/port
questions, TLS, Hive SSO registration with its browser/password/retry fallbacks
— live in sb90-deploy (System-B90/deploy-py). This file only asks Bluz's own
questions.

Runs from the bundle root (./install.sh runs it; re-run with
`python3 bootstrap.py setup`) and from a checkout (`python scripts/setup.py`,
with sb90-deploy installed from scripts/requirements.txt).
"""

import os
import sys

try:
    from sb90_deploy.spec import AppSpec
    from sb90_deploy.wizard import Wizard, password
except ImportError:
    print(
        "Error: sb90-deploy is not installed. In a release bundle, run ./install.sh;\n"
        "in a checkout: pip install -r scripts/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)


def _spec() -> AppSpec:
    """app.json sits beside setup.py in a bundle and under deploy/ in a checkout."""
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(here, "app.json"),
        os.path.join(here, "..", "deploy", "app.json"),
    ):
        if os.path.isfile(candidate):
            return AppSpec.load(candidate)
    raise SystemExit("app.json not found next to setup.py or in deploy/")


def main() -> None:
    w = Wizard(_spec())

    domain = w.domain(example="bluz.example.com")
    w.set("WEBSOCKET_SESSION_SERVER_HOST", domain)
    # Where the proxy publishes; asks only when another stack shares the host.
    w.ports()
    w.tls(domain, ssl_dir="nginx/ssl", cert_name="cert.pem", key_name="key.pem")

    hive_url = w.ask(
        "NEXT_PUBLIC_HIVE_URL", "Hive URL (NEXT_PUBLIC_HIVE_URL)", "https://hive.org"
    )
    w.set("NODE_TLS_REJECT_UNAUTHORIZED", "0")

    # No "latest" default: that tag is never published. install fills this in
    # from the bundle's VERSION file.
    w.keep("BLUZ_VERSION")

    for key in (
        "WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY",
        "NEXTAUTH_SECRET",
        "JWT_SECRET",
        "SYM_ENC_KEY",
    ):
        w.generated(key)

    pg_user = w.keep("POSTGRES_USER", "admin")
    pg_pass = w.generated("POSTGRES_PASSWORD", password)
    pg_db = w.keep("POSTGRES_DB", "curriculum_db")
    w.keep(
        "DATABASE_URL",
        f"postgres://{pg_user}:{pg_pass}@bluz-curriculum-db:5432/{pg_db}",
    )

    mongo_user = w.keep("MONGO_ROOT_USER", "mongo_admin")
    mongo_pass = w.generated("MONGO_ROOT_PASSWORD", password)
    w.keep(
        "MONGO_CONNECTION_STRING",
        f"mongodb://{mongo_user}:{mongo_pass}@bluz-mongodb:27017/?authSource=admin",
    )

    # Service account for the lesson activator, which opens a Hive queue the
    # moment a Bluz event starts — a timer job, so it can't use a human's SSO.
    w.ask(
        "HIVE_API_USERNAME",
        "Hive API user for background lesson assignment (HIVE_API_USERNAME)",
        "api",
    )
    # No default password on purpose: an unset one leaves the activator off
    # (see api-server/hive/service-client.ts), which beats a guessable one.
    if not w.ask_secret(
        "HIVE_API_PASSWORD",
        "Hive API user password (HIVE_API_PASSWORD, "
        "leave unset to disable the lesson activator)",
    ):
        print(
            "  No Hive API password set - the lesson activator will stay off "
            "and queues will not open automatically."
        )

    w.sso(hive_url)

    # Google Calendar sync needs no per-deployment setup; these only override
    # the built-in OAuth app (e.g. custom consent-screen branding).
    w.keep("GOOGLE_CLIENT_ID")
    w.keep("GOOGLE_CLIENT_SECRET")
    if w.confirm(
        "Override the built-in Google OAuth app for Calendar sync? "
        "(default: no - no setup needed)",
        default=bool(w.prev("GOOGLE_CLIENT_ID")),
    ):
        w.ask("GOOGLE_CLIENT_ID", "Google OAuth Client ID (GOOGLE_CLIENT_ID)")
        w.ask_secret(
            "GOOGLE_CLIENT_SECRET", "Google OAuth Client Secret (GOOGLE_CLIENT_SECRET)"
        )

    # AI assistant: optional; with no key the launcher is simply hidden.
    w.keep("AI_PROVIDER", "openrouter")
    w.keep("AI_MODEL")
    w.keep("OPENROUTER_API_KEY")
    if w.confirm(
        "Enable the in-app AI assistant? (needs a model provider API key)",
        default=bool(w.prev("OPENROUTER_API_KEY")),
    ):
        w.ask("AI_PROVIDER", "AI provider (AI_PROVIDER)", "openrouter")
        w.ask("AI_MODEL", "Model slug (AI_MODEL, blank = provider default)")
        w.ask_secret("OPENROUTER_API_KEY", "Provider API key (OPENROUTER_API_KEY)")

    w.write()


if __name__ == "__main__":
    main()
