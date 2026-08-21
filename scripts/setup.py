"""
Name: setup.py
Purpose: Interactive CLI script to generate the .env configuration file for Bluz, handle SSL, and register SSO.
Created: 2026-04-11
Author: Michael K. Steinberg
"""

import os
import re
import secrets
import shutil
import string
import subprocess
import sys
from pathlib import Path

try:
    import typer
    from dotenv import dotenv_values
    from InquirerPy import inquirer
except ImportError as e:
    print(f"Error: Missing required dependency '{e.name}'.", file=sys.stderr)
    print("Please install the required packages by running:\n", file=sys.stderr)
    print("    pip install typer InquirerPy python-dotenv\n", file=sys.stderr)
    # The org pip index, served over GitHub Pages. This used to point at a
    # git+https URL because System-B90/.github#10 had not landed and the index
    # was hosted on raw.githubusercontent.com, which cannot back a pip index --
    # it maps URLs 1:1 onto repo paths with no directory-index fallback, so
    # pip's request for the bare package directory 404s. That fix merged
    # 2026-08-04, and this form needs no repo access or git credentials.
    print(
        "    pip install PyHiveLMS --index-url "
        "https://system-b90.github.io/.github/pypi/\n",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from pyhive import HiveClient
except ImportError:
    HiveClient = None

app = typer.Typer(help="Bluz interactive environment setup utility.")


def is_ssh_only_session() -> bool:
    """
    Detects a terminal-only (SSH, no local browser) session.

    Returns:
        bool: True if running over SSH with no display available.
    """
    if not (
        os.environ.get("SSH_CONNECTION")
        or os.environ.get("SSH_TTY")
        or os.environ.get("SSH_CLIENT")
    ):
        return False
    if sys.platform.startswith("win"):
        return True
    return not os.environ.get("DISPLAY")


def get_hive_client_via_password(
    hive_url: str, verify: bool, reason: str = ""
) -> "HiveClient":
    """
    Authenticates to Hive with a username/password instead of the interactive
    browser SSO flow. Used when no local browser is reachable, and as the
    fallback when the browser flow fails.

    Args:
        hive_url (str): The base URL of the Hive server.
        verify (bool): SSL verification setting for the HTTP client.
        reason (str): Why the password path is being used, shown to the user.

    Returns:
        HiveClient: An authenticated HiveClient instance.
    """
    # This deliberately goes through HiveClient's own constructor, which
    # authenticates against /api/core/token/. The previous implementation
    # hand-rolled an OAuth2 resource-owner-password-grant POST to
    # /api/core/sso/token/ instead — Hive's default SSO client only permits the
    # authorization-code grant, so that path returned unauthorized_client for
    # every credential and the installer silently fell through to
    # MANUAL_ENTRY_REQUIRED (#412).
    if reason:
        typer.secho(f"\n{reason}", fg=typer.colors.YELLOW)
    typer.echo("Sign in with a Hive account that can register SSO applications.")

    username = inquirer.text(message="Hive username:").execute()
    password = inquirer.secret(message="Hive password:").execute()

    return HiveClient(
        username=username,
        password=password,
        hive_url=hive_url,
        verify=verify,
    )


def register_sso_with_retry(hive_url: str, redirect_uri: str) -> tuple[str, str]:
    """
    Registers Bluz as an SSO application with Hive, falling back between the
    browser and password flows and offering a retry before giving up.

    Args:
        hive_url (str): The base URL of the Hive server.
        redirect_uri (str): The OAuth callback URI to register for Bluz.

    Returns:
        tuple[str, str]: The (client_id, client_secret) pair, or a pair of
            MANUAL_ENTRY_REQUIRED placeholders if every attempt failed.
    """
    # A failure here used to end the attempt outright and leave placeholders in
    # .env, which meant sign-in was broken post-install with no further prompt
    # (#412). The browser flow and the password flow fail for unrelated reasons
    # — no reachable browser vs. wrong credentials — so each is worth trying
    # when the other fails.
    browser_first = not is_ssh_only_session()

    attempts: list[tuple[str, object]] = []
    if browser_first:
        attempts.append(
            ("browser", lambda: HiveClient.from_sso(hive_url=hive_url, verify=False))
        )
        attempts.append(
            (
                "password",
                lambda: get_hive_client_via_password(
                    hive_url,
                    verify=False,
                    reason="Browser sign-in did not complete. Falling back to username/password.",
                ),
            )
        )
    else:
        attempts.append(
            (
                "password",
                lambda: get_hive_client_via_password(
                    hive_url,
                    verify=False,
                    reason="No local browser reachable (SSH/terminal-only session).",
                ),
            )
        )

    last_error: Exception | None = None
    for _name, build_client in attempts:
        try:
            client = build_client()  # type: ignore[operator]
            credentials = client.register_sso_service(
                service_name="Bluz",
                redirect_uris=redirect_uri,
            )
            client_id = credentials.get("client_id", "")
            client_secret = credentials.get("client_secret", "")
            if client_id and client_secret:
                typer.secho("Hive SSO registration successful.", fg=typer.colors.GREEN)
                return client_id, client_secret
            last_error = RuntimeError(
                "Hive accepted the registration but returned no client_id/client_secret."
            )
        except Exception as e:  # noqa: BLE001 - every failure mode is retryable here
            last_error = e
            typer.secho(f"  Attempt failed: {e}", fg=typer.colors.YELLOW)

    typer.secho(f"\nFailed to register Hive SSO: {last_error}", fg=typer.colors.RED)
    typer.secho(
        "Sign-in will NOT work until HIVE_CLIENT_ID and HIVE_CLIENT_SECRET are set.",
        fg=typer.colors.RED,
    )
    typer.echo(
        "\nRegister by hand instead (this uses the same working endpoint):\n"
        "    pip install PyHiveLMS --index-url "
        "https://system-b90.github.io/.github/pypi/\n"
        f"    pyhive -u <admin-user> -p <password> register Bluz --hive-url {hive_url}\n"
        "then copy the returned client_id / client_secret into .env."
    )

    if inquirer.confirm(message="Try registering again now?", default=True).execute():
        return register_sso_with_retry(hive_url, redirect_uri)

    return "MANUAL_ENTRY_REQUIRED", "MANUAL_ENTRY_REQUIRED"


def generate_password(length: int = 32) -> str:
    """
    Generates a cryptographically secure random password.

    Args:
        length (int): The required length of the password. Defaults to 32.

    Returns:
        str: The generated password string containing letters, digits, and punctuation.
    """
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_hex_key(bytes_length: int = 32) -> str:
    """
    Generates a cryptographically secure random hexadecimal key.

    Args:
        bytes_length (int): The number of bytes to generate. Defaults to 32.

    Returns:
        str: The generated hexadecimal key.
    """
    return secrets.token_hex(bytes_length)


def get_cert_cn(cert_path: Path) -> str:
    """
    Extracts the Common Name (CN) from an X.509 certificate using OpenSSL.

    Args:
        cert_path (Path): Path to the certificate file.

    Returns:
        str: The extracted Common Name, or an empty string if extraction fails.
    """
    if not shutil.which("openssl"):
        return ""

    try:
        result = subprocess.run(
            ["openssl", "x509", "-noout", "-subject", "-in", str(cert_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        match = re.search(r"CN\s*=\s*([^,\n]+)", result.stdout)
        if match:
            return match.group(1).strip()
    except subprocess.CalledProcessError:
        pass

    return ""


def handle_ssl_certs(domain_name: str) -> None:
    """
    Manages the creation and validation of SSL certificates for the provided domain.

    Args:
        domain_name (str): The expected domain name for the certificate CN.

    Returns:
        None
    """
    ssl_dir = Path("nginx/ssl")
    ssl_dir.mkdir(parents=True, exist_ok=True)

    cert_path = ssl_dir / "cert.pem"
    key_path = ssl_dir / "key.pem"
    needs_cert = True

    if cert_path.exists() and key_path.exists():
        existing_cn = get_cert_cn(cert_path)
        if existing_cn == domain_name:
            typer.secho(
                f"Valid certificates found for {domain_name}.", fg=typer.colors.GREEN
            )
            needs_cert = False
        else:
            typer.secho(
                f"Warning: Existing certificate CN ('{existing_cn}') does not match expected domain ('{domain_name}').",
                fg=typer.colors.YELLOW,
            )

    if needs_cert:
        generate = inquirer.confirm(
            message=f"Generate self-signed SSL certificates for {domain_name}?",
            default=True,
        ).execute()

        if generate:
            if not shutil.which("openssl"):
                typer.secho(
                    "Error: 'openssl' command not found. Cannot generate certificates.",
                    fg=typer.colors.RED,
                )
                return

            typer.echo("Generating certificates...")
            try:
                subprocess.run(
                    [
                        "openssl",
                        "req",
                        "-x509",
                        "-newkey",
                        "rsa:4096",
                        "-keyout",
                        str(key_path),
                        "-out",
                        str(cert_path),
                        "-sha256",
                        "-days",
                        "365",
                        "-nodes",
                        "-subj",
                        f"/CN={domain_name}",
                    ],
                    check=True,
                    capture_output=True,
                )
                typer.secho(
                    "Successfully generated self-signed certificates.",
                    fg=typer.colors.GREEN,
                )
            except subprocess.CalledProcessError as e:
                typer.secho(
                    f"Failed to generate certificates: {e.stderr.decode()}",
                    fg=typer.colors.RED,
                )


@app.command()
def generate_env() -> None:
    """
    Interactively prompts for configuration values, generates secure secrets,
    registers the SSO service with Hive, validates/generates SSL certs,
    and writes the variables to a local .env file.

    Args:
        None

    Returns:
        None
    """
    typer.echo("Starting Bluz interactive environment setup...")

    env_path = Path(".env")
    existing_env = dotenv_values(env_path) if env_path.exists() else {}

    # Domain & URL setup
    existing_nextauth_url = existing_env.get("NEXTAUTH_URL", "")
    default_domain = ""
    if existing_nextauth_url:
        default_domain = existing_nextauth_url.replace("https://", "").replace(
            "http://", ""
        )

    domain_name = inquirer.text(
        message="Enter the domain name for Bluz (e.g., bluz.example.com):",
        default=default_domain,
    ).execute()

    nextauth_url = f"https://{domain_name}"

    # Handle SSL Validation and Generation
    handle_ssl_certs(domain_name)

    # Where the proxy publishes. Defaults bind every address on :80/:443, which
    # is right for the recommended setup (Bluz alone on its own host). Sharing a
    # machine with another web stack is the case that needs a decision, so ask
    # rather than hardcoding a loopback alias that does not exist on Windows
    # (#412).
    bind_ip = existing_env.get("BLUZ_BIND_IP", "0.0.0.0")
    http_port = existing_env.get("BLUZ_HTTP_PORT", "80")
    https_port = existing_env.get("BLUZ_HTTPS_PORT", "443")

    shares_host = inquirer.confirm(
        message=(
            "Is another web server (e.g. a local Hive stack) already using "
            "ports 80/443 on this machine?"
        ),
        default=http_port != "80",
    ).execute()

    if shares_host:
        typer.secho(
            "\nGiving Bluz its own ports is the portable way to share a host.\n"
            "Binding a separate loopback IP also works on Linux, but on Windows it\n"
            "needs an admin-added loopback alias AND the other stack must stop\n"
            "binding 0.0.0.0 — Docker Desktop reserves published ports by number.",
            fg=typer.colors.YELLOW,
        )
        http_port = inquirer.text(
            message="HTTP port for Bluz (BLUZ_HTTP_PORT):",
            default=http_port if http_port != "80" else "8080",
        ).execute()
        https_port = inquirer.text(
            message="HTTPS port for Bluz (BLUZ_HTTPS_PORT):",
            default=https_port if https_port != "443" else "8443",
        ).execute()
        bind_ip = inquirer.text(
            message="Bind address (BLUZ_BIND_IP, 0.0.0.0 = all interfaces):",
            default=bind_ip,
        ).execute()

    # Hive & Auth Setup
    default_hive_url = existing_env.get("NEXT_PUBLIC_HIVE_URL", "https://hive.org")
    hive_url = inquirer.text(
        message="Enter Hive URL (NEXT_PUBLIC_HIVE_URL):", default=default_hive_url
    ).execute()

    # Preserve or Auto-generate DB Credentials & Cryptographic Secrets
    ws_auth_key = existing_env.get(
        "WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY"
    ) or generate_hex_key(32)
    nextauth_secret = existing_env.get("NEXTAUTH_SECRET") or generate_hex_key(32)
    jwt_secret = existing_env.get("JWT_SECRET") or generate_hex_key(32)
    sym_enc_key = existing_env.get("SYM_ENC_KEY") or generate_hex_key(32)

    pg_user = existing_env.get("POSTGRES_USER", "admin")
    pg_pass = existing_env.get("POSTGRES_PASSWORD") or generate_password()
    pg_db = existing_env.get("POSTGRES_DB", "curriculum_db")
    db_url = (
        existing_env.get("DATABASE_URL")
        or f"postgres://{pg_user}:{pg_pass}@bluz-curriculum-db:5432/{pg_db}"
    )

    mongo_user = existing_env.get("MONGO_ROOT_USER", "mongo_admin")
    mongo_pass = existing_env.get("MONGO_ROOT_PASSWORD") or generate_password()
    mongo_url = (
        existing_env.get("MONGO_CONNECTION_STRING")
        or f"mongodb://{mongo_user}:{mongo_pass}@bluz-mongodb:27017/?authSource=admin"
    )

    hive_client_id = existing_env.get("HIVE_CLIENT_ID", "")
    hive_client_secret = existing_env.get("HIVE_CLIENT_SECRET", "")

    # Service account used by the lesson activator, which opens a Hive queue
    # the moment a Bluz event starts. SSO tokens belong to a logged-in human;
    # that job runs on a timer, so it needs an account of its own.
    hive_api_username = inquirer.text(
        message="Hive API user for background lesson assignment (HIVE_API_USERNAME):",
        default=existing_env.get("HIVE_API_USERNAME", "api"),
    ).execute()
    # No default password on purpose: a guessable one baked into a real .env
    # is worse than no activator at all, and an unset password simply leaves
    # the activator switched off (see api-server/hive/service-client.ts).
    hive_api_password = inquirer.secret(
        message=(
            "Hive API user password (HIVE_API_PASSWORD, blank to keep "
            "existing; leave unset to disable the lesson activator):"
        ),
    ).execute() or existing_env.get("HIVE_API_PASSWORD", "")
    if not hive_api_password:
        print(
            "  No Hive API password set — the lesson activator will stay off "
            "and queues will not open automatically."
        )

    register_sso = True
    if (
        hive_client_id
        and hive_client_secret
        and hive_client_id != "MANUAL_ENTRY_REQUIRED"
    ):
        register_sso = inquirer.confirm(
            message="Existing Hive SSO credentials found. Re-register?", default=False
        ).execute()

    if register_sso:
        if HiveClient is None:
            typer.secho(
                "Warning: 'pyhive' module not found. Hive SSO registration skipped.",
                fg=typer.colors.YELLOW,
            )
            hive_client_id = "MANUAL_ENTRY_REQUIRED"
            hive_client_secret = "MANUAL_ENTRY_REQUIRED"
        else:
            typer.echo(f"Registering Bluz SSO service with Hive at {hive_url}...")
            hive_client_id, hive_client_secret = register_sso_with_retry(
                hive_url=hive_url,
                redirect_uri=f"{nextauth_url}/api/auth/callback/hive",
            )

    # Google Calendar sync needs NO per-deployment setup: users connect with a
    # "Continue with Google" popup and Bluz ships shared OAuth credentials.
    # These env vars exist only as an optional override for admins who want
    # their own Google Cloud project (e.g. custom branding on the consent
    # screen). Leave blank to use the built-in defaults.
    google_client_id = existing_env.get("GOOGLE_CLIENT_ID", "")
    google_client_secret = existing_env.get("GOOGLE_CLIENT_SECRET", "")
    override_google_oauth = inquirer.confirm(
        message="Override the built-in Google OAuth app for Calendar sync? (default: no — no setup needed)",
        default=bool(google_client_id),
    ).execute()
    if override_google_oauth:
        google_client_id = inquirer.text(
            message="Enter Google OAuth Client ID (GOOGLE_CLIENT_ID):",
            default=google_client_id,
        ).execute()
        google_client_secret = (
            inquirer.secret(
                message="Enter Google OAuth Client Secret (GOOGLE_CLIENT_SECRET):",
            ).execute()
            or google_client_secret
        )

    # AI assistant. Optional: with no key the assistant hides its launcher
    # rather than failing on first use, so a deployment that does not want it
    # simply leaves this blank.
    ai_provider = existing_env.get("AI_PROVIDER", "openrouter")
    ai_model = existing_env.get("AI_MODEL", "")
    ai_api_key = existing_env.get("OPENROUTER_API_KEY", "")
    enable_ai = inquirer.confirm(
        message="Enable the in-app AI assistant? (needs a model provider API key)",
        default=bool(ai_api_key),
    ).execute()
    if enable_ai:
        ai_provider = inquirer.text(
            message="AI provider (AI_PROVIDER):",
            default=ai_provider,
        ).execute()
        ai_model = inquirer.text(
            message="Model slug (AI_MODEL, blank = provider default):",
            default=ai_model,
        ).execute()
        ai_api_key = (
            inquirer.secret(
                message="Provider API key (OPENROUTER_API_KEY):",
            ).execute()
            or ai_api_key
        )

    env_content: dict[str, str] = {
        # No "latest" default: that tag is never published (only tagged v*
        # builds push images), so defaulting to it turns a missing version into
        # a manifest-not-found much later instead of an error here. install.sh /
        # install.ps1 fill this in from the bundle's VERSION file.
        "BLUZ_VERSION": existing_env.get("BLUZ_VERSION", ""),
        "BLUZ_BIND_IP": bind_ip,
        "BLUZ_HTTP_PORT": http_port,
        "BLUZ_HTTPS_PORT": https_port,
        "WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY": ws_auth_key,
        "WEBSOCKET_SESSION_SERVER_HOST": domain_name,
        "NEXT_PUBLIC_HIVE_URL": hive_url,
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "NEXTAUTH_URL": nextauth_url,
        "NEXTAUTH_SECRET": nextauth_secret,
        "HIVE_CLIENT_ID": hive_client_id,
        "HIVE_CLIENT_SECRET": hive_client_secret,
        "HIVE_API_USERNAME": hive_api_username,
        "HIVE_API_PASSWORD": hive_api_password,
        "MONGO_ROOT_USER": mongo_user,
        "MONGO_ROOT_PASSWORD": mongo_pass,
        "MONGO_CONNECTION_STRING": mongo_url,
        "JWT_SECRET": jwt_secret,
        "SYM_ENC_KEY": sym_enc_key,
        "POSTGRES_USER": pg_user,
        "POSTGRES_PASSWORD": pg_pass,
        "POSTGRES_DB": pg_db,
        "DATABASE_URL": db_url,
        "GOOGLE_CLIENT_ID": google_client_id,
        "GOOGLE_CLIENT_SECRET": google_client_secret,
        "AI_PROVIDER": ai_provider,
        "AI_MODEL": ai_model,
        "OPENROUTER_API_KEY": ai_api_key,
    }

    with env_path.open("w", encoding="utf-8") as f:
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")

    typer.secho(f"Successfully generated {env_path.resolve()}", fg=typer.colors.GREEN)


if __name__ == "__main__":
    app()
