"""
Name: setup.py
Purpose: Interactive CLI script to generate the .env configuration file for Bluz, handle SSL, and register SSO.
Created: 2026-04-11
Author: Michael K. Steinberg
"""

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
    print("    pip install git+https://github.com/System-B15/pyhive.git@main\n", file=sys.stderr)
    sys.exit(1)

try:
    from pyhive import HiveClient
except ImportError:
    HiveClient = None

app = typer.Typer(help="Bluz interactive environment setup utility.")


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
            try:
                client = HiveClient.from_sso(hive_url=hive_url, verify=False)
                sso_credentials = client.register_sso_service(
                    service_name="Bluz",
                    redirect_uris=f"{nextauth_url}/api/auth/callback/hive",
                )
                hive_client_id = sso_credentials.get("client_id", "ERROR_FETCHING_ID")
                hive_client_secret = sso_credentials.get(
                    "client_secret", "ERROR_FETCHING_SECRET"
                )
                typer.secho("Hive SSO registration successful.", fg=typer.colors.GREEN)
            except Exception as e:
                typer.secho(f"Failed to register Hive SSO: {e}", fg=typer.colors.RED)
                hive_client_id = "MANUAL_ENTRY_REQUIRED"
                hive_client_secret = "MANUAL_ENTRY_REQUIRED"

    # Google Calendar sync is opt-in per user and entirely optional at the
    # deployment level — offline / air-gapped installs just skip this.
    google_client_id = existing_env.get("GOOGLE_CLIENT_ID", "")
    google_client_secret = existing_env.get("GOOGLE_CLIENT_SECRET", "")
    enable_google_calendar = inquirer.confirm(
        message="Enable optional Google Calendar sync? (requires internet access; skip for offline deployments)",
        default=bool(google_client_id),
    ).execute()
    if enable_google_calendar:
        google_client_id = inquirer.text(
            message="Enter Google OAuth Client ID (GOOGLE_CLIENT_ID):",
            default=google_client_id,
        ).execute()
        google_client_secret = inquirer.secret(
            message="Enter Google OAuth Client Secret (GOOGLE_CLIENT_SECRET):",
        ).execute() or google_client_secret

    env_content: dict[str, str] = {
        "BLUZ_VERSION": existing_env.get("BLUZ_VERSION", "latest"),
        "WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY": ws_auth_key,
        "NEXT_PUBLIC_HIVE_URL": hive_url,
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "NEXTAUTH_URL": nextauth_url,
        "NEXTAUTH_SECRET": nextauth_secret,
        "HIVE_CLIENT_ID": hive_client_id,
        "HIVE_CLIENT_SECRET": hive_client_secret,
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
        "GOOGLE_REDIRECT_URI": f"{nextauth_url}/api/integrations/google-calendar/callback",
    }

    with env_path.open("w", encoding="utf-8") as f:
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")

    typer.secho(f"Successfully generated {env_path.resolve()}", fg=typer.colors.GREEN)


if __name__ == "__main__":
    app()
