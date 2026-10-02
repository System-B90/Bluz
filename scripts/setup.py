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


# Where docker-compose mounts ./acme/ca for a private ACME server CA (#803).
ACME_CA_DEFAULT_PATH = "/etc/bluz/acme-ca/ca.pem"
# The compose profile that runs the certbot sidecar (#803).
ACME_PROFILE = "acme"

# Where docker-compose mounts ./ai-ca for a private AI gateway CA (#780).
AI_CA_DEFAULT_PATH = "/etc/bluz/ai-ca/ca.pem"


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


def _ask_private_ca(
    w: Wizard, key: str, question: str, default_path: str, hint: str
) -> None:
    """Asks for a private CA's path inside the container, or clears it.

    Shared by every client that may talk to a server signed by an internal
    CA; validation is never disabled, the CA is trusted instead.
    """
    if w.confirm(question, default=bool(w.prev(key))):
        w.ask(key, f"CA bundle path inside the container ({key})", default_path)
        print(f"  {hint}")
    else:
        w.set(key, "")


def _profiles_with(current: str, profile: str, enabled: bool) -> str:
    """COMPOSE_PROFILES with `profile` added or removed, others kept in order."""
    names = [p for p in (s.strip() for s in current.split(",")) if p and p != profile]
    if enabled:
        names.append(profile)
    return ",".join(names)


def _ask_acme(w: Wizard, domain: str) -> None:
    """Optional ACME certificates (#803), e.g. the network's own Let's Encrypt.

    The self-signed certificate from w.tls() stays in place until the certbot
    sidecar issues the real one, so the proxy can always start.
    """
    for key in ("ACME_DIRECTORY_URL", "ACME_EMAIL", "ACME_CA_BUNDLE"):
        w.keep(key)
    w.keep("COMPOSE_PROFILES")
    enabled = w.confirm(
        "Issue the certificate from an ACME server (e.g. an internal Let's Encrypt)?",
        default=bool(w.prev("ACME_DIRECTORY_URL")),
    )
    w.set(
        "COMPOSE_PROFILES",
        _profiles_with(w.prev("COMPOSE_PROFILES"), ACME_PROFILE, enabled),
    )
    if not enabled:
        return
    w.ask(
        "ACME_DIRECTORY_URL",
        "ACME directory URL (ACME_DIRECTORY_URL, e.g. https://acme.internal/directory)",
        required=True,
    )
    w.ask("ACME_EMAIL", "Contact e-mail for the ACME account (ACME_EMAIL, optional)")
    w.set("ACME_DOMAIN", domain)
    if w.confirm(
        "Is the ACME server itself signed by a private CA?",
        default=bool(w.prev("ACME_CA_BUNDLE")),
    ):
        w.ask(
            "ACME_CA_BUNDLE",
            "ACME server CA path inside the container (ACME_CA_BUNDLE)",
            ACME_CA_DEFAULT_PATH,
        )
        print(
            "  Copy the ACME server's CA (PEM) to acme/ca/ca.pem beside "
            "docker-compose.yml."
        )
    print(
        "  The ACME server must reach this host on port 80 (HTTP-01). "
        "The certbot service renews every 12h."
    )


def _ask_ai(w: Wizard) -> None:
    """AI assistant: optional; with no key the launcher is simply hidden."""
    w.keep("AI_PROVIDER", "openrouter")
    w.keep("AI_MODEL")
    w.keep("OPENROUTER_API_KEY")
    w.keep("OPENAI_BASE_URL")
    w.keep("OPENAI_API_KEY")
    w.keep("AI_CA_CERT_PATH")
    if w.confirm(
        "Enable the in-app AI assistant? (needs a model provider API key)",
        default=bool(w.prev("OPENROUTER_API_KEY") or w.prev("OPENAI_API_KEY")),
    ):
        provider = w.ask(
            "AI_PROVIDER",
            "AI provider (AI_PROVIDER: openrouter / openai)",
            "openrouter",
        )
        w.ask("AI_MODEL", "Model slug (AI_MODEL, blank = provider default)")
        if provider == "openai":
            w.ask(
                "OPENAI_BASE_URL",
                "OpenAI-compatible base URL (OPENAI_BASE_URL, Open WebUI: https://<host>/api)",
            )
            w.ask_secret("OPENAI_API_KEY", "Gateway API key (OPENAI_API_KEY)")
        else:
            w.ask_secret("OPENROUTER_API_KEY", "Provider API key (OPENROUTER_API_KEY)")
        # Internal gateways often use a private CA (#780). Never disable
        # validation: trust the CA for the AI client only.
        _ask_private_ca(
            w,
            "AI_CA_CERT_PATH",
            "Does the AI gateway use a certificate from a private CA?",
            AI_CA_DEFAULT_PATH,
            "Copy the CA certificate (PEM) to ai-ca/ca.pem beside "
            "docker-compose.yml; it is mounted at /etc/bluz/ai-ca.",
        )


def main() -> None:
    w = Wizard(_spec())

    domain = w.domain(example="bluz.example.com")
    w.set("WEBSOCKET_SESSION_SERVER_HOST", domain)
    # Where the proxy publishes; asks only when another stack shares the host.
    w.ports()
    w.tls(domain, ssl_dir="nginx/ssl", cert_name="cert.pem", key_name="key.pem")
    _ask_acme(w, domain)

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

    _ask_ai(w)

    w.write()


if __name__ == "__main__":
    main()
