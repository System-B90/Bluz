"""
Name: run_tests.py
Purpose: CLI entry point for npm run test. Coordinates Docker Compose, Drizzle schema push, seeding, and Playwright tests with dynamic ports.
Author: Antigravity
"""

import hashlib
import os
import secrets
import socket
import ssl
import subprocess
import sys
import time
import urllib.request

import typer
from dotenv import dotenv_values
from pyhive import HiveClient

app = typer.Typer(help="Bluz E2E testing pipeline utility.")

# Hostname the app is reached by. It has to be one name everywhere — the SSO
# redirect URI, NEXTAUTH_URL and Playwright's baseURL — because Hive matches
# the callback origin exactly. Resolves to 127.0.0.3 via the hosts file (CI
# maps it in setup-hive; locally see the dev setup docs).
APP_HOST = os.environ.get("BLUZ_APP_HOST", "bluz.dev")


def get_worktree_slug() -> str:
    """Generates a unique identifier for the current worktree directory."""
    cwd = os.getcwd()
    dir_name = os.path.basename(cwd)
    path_hash = hashlib.md5(cwd.encode("utf-8")).hexdigest()[:8]
    return f"{dir_name}-{path_hash}".lower()


def find_free_port(ip: str = "127.0.0.3") -> int:
    """Finds a free port on the specified IP address."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((ip, 0))
        return s.getsockname()[1]


def get_running_port(project_name: str, service: str, internal_port: int) -> int:
    """Queries the mapped host port for a running service."""
    try:
        # Run docker compose port command
        result = subprocess.run(
            [
                "docker",
                "compose",
                "-p",
                project_name,
                "-f",
                "deploy/docker-compose.yml",
                "-f",
                "deploy/docker-compose.test.yml",
                "port",
                service,
                str(internal_port),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        output = result.stdout.strip()
        if ":" in output:
            return int(output.split(":")[-1])
    except subprocess.CalledProcessError:
        pass
    return 0


def check_project_running(project_name: str) -> bool:
    """Checks if the docker compose project is already running."""
    try:
        # Check if any container with the project label is running
        result = subprocess.run(
            [
                "docker",
                "ps",
                "--filter",
                f"label=com.docker.compose.project={project_name}",
                "--filter",
                "status=running",
                "-q",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return bool(result.stdout.strip())
    except subprocess.CalledProcessError:
        return False


def wait_for_ui_ready(port: int, timeout: int = 120) -> bool:
    """Polls the UI login page until it returns 200 OK (handling self-signed SSL).

    One 200 only proves the route can be served, not that it is warm: the very
    first browser navigation still paid for the server-render and regularly
    lost the race against login.spec's 5s assertion, which is why that spec
    kept coming back "flaky" as the suite's first test. Serving the page a few
    times here settles it before Playwright starts.
    """
    url = f"https://127.0.0.3:{port}/login"
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, context=ctx, timeout=15) as response:
                if response.status == 200:
                    for _ in range(2):
                        try:
                            urllib.request.urlopen(url, context=ctx, timeout=15).read()
                        except Exception:
                            break
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False


@app.command()
def main(
    ui: bool = typer.Option(
        False, "--ui", help="Run Playwright tests with interactive UI."
    ),
    visual: bool = typer.Option(
        False,
        "--visual",
        help="Run Playwright tests in visual mode (headed + single window).",
    ),
    seed_hive: bool = typer.Option(
        False, "--seed-hive", help="Clear and reseed the Hive database."
    ),
    rebuild: bool = typer.Option(
        False, "--rebuild", help="Force rebuild and restart of Docker containers."
    ),
    seed_only: bool = typer.Option(
        False,
        "--seed-only",
        help="Only build/start containers and seed database, then exit.",
    ),
    grep: str = typer.Option(
        None, "--grep", help="Run tests matching specific pattern."
    ),
    spec: str = typer.Option(
        None,
        "--spec",
        help="Run specific test spec file (e.g. calendar, gantt, settings).",
    ),
    shard: str = typer.Option(
        None,
        "--shard",
        help="Run a subset of tests via Playwright sharding, e.g. '1/3'.",
    ),
    skip_unit: bool = typer.Option(
        False,
        "--skip-unit",
        help="Skip backend unit tests (use when they already run in a separate CI job).",
    ),
):
    """
    Main entry point for testing pipeline.
    Handles dynamic ports, Docker startup, DB migrations, seeding, and test execution.
    """
    typer.secho(
        "Initializing Bluz Testing Pipeline...", fg=typer.colors.CYAN, bold=True
    )

    # Load root .env variables to inherit configurations
    typer.secho(
        "Importing environment configurations...", fg=typer.colors.CYAN, bold=True
    )

    root_env = dotenv_values(".env")

    merged_env: dict[str, str] = os.environ.copy()
    merged_env.update({k: str(v) for k, v in root_env.items() if v is not None})

    # Run Backend Unit Tests (fail fast)
    if not seed_only and not skip_unit:
        typer.secho("Running Backend Unit Tests...", fg=typer.colors.CYAN, bold=True)
        try:
            # String command: shell=True + list args resolves differently on
            # POSIX (list items become sh positional args, not the command).
            subprocess.run(
                "npm run test:unit",
                shell=True,
                check=True,
                env=merged_env,
            )
            typer.secho("Backend Unit Tests Passed!", fg=typer.colors.GREEN, bold=True)
        except subprocess.CalledProcessError:
            typer.secho("Backend Unit Tests Failed!", fg=typer.colors.RED, bold=True)
            raise RuntimeError("Backend Unit Tests failed.")

    # Determine Project Name and Environment
    slug = get_worktree_slug()
    project_name = f"bluz-test-{slug}"
    typer.echo(f"Worktree Slug: {slug}")
    typer.echo(f"Docker Project: {project_name}")

    # Check if Docker Compose is running
    is_running = check_project_running(project_name)
    ports: dict[str, int] = {}

    compose_env: dict[str, str] = {
        **merged_env,
        "TEST_PROJECT_NAME": project_name,
        "BLUZ_VERSION": "latest",
        # docker-compose.test.yml points the ui container's Mongo connection
        # string at TEST_MONGO_PASSWORD, but mongodb's actual root password
        # (set by the base compose file) is MONGO_ROOT_PASSWORD -- reuse it
        # so the ui container can authenticate against the real password.
        "TEST_MONGO_PASSWORD": root_env.get("MONGO_ROOT_PASSWORD", ""),
        # docker-compose.test.yml builds NEXTAUTH_URL from this, so the app
        # announces the same host the SSO client was registered with.
        "BLUZ_APP_HOST": APP_HOST,
    }

    new_ui_container = True

    if is_running and not rebuild:
        typer.secho(
            "Existing test containers detected. Reusing them to optimize runtime.",
            fg=typer.colors.GREEN,
        )
        new_ui_container = False

        # Query existing ports
        ports["postgres"] = get_running_port(project_name, "curriculum-db", 5432)
        ports["mongo"] = get_running_port(project_name, "mongodb", 27017)
        ports["http"] = get_running_port(project_name, "proxy", 80)
        ports["https"] = get_running_port(project_name, "proxy", 443)

        # Verify we successfully retrieved all ports
        if not all(ports.values()):
            typer.secho(
                "Failed to query all running ports. Will attempt full restart.",
                fg=typer.colors.YELLOW,
            )
            is_running = False
            new_ui_container = True

    if not is_running or rebuild:
        if rebuild:
            typer.secho(
                "Force rebuild requested. Tearing down existing containers...",
                fg=typer.colors.YELLOW,
            )
        else:
            typer.secho(
                "No running containers detected. Starting fresh with new volumes...",
                fg=typer.colors.CYAN,
            )
        subprocess.run(
            [
                "docker",
                "compose",
                "-p",
                project_name,
                "-f",
                "deploy/docker-compose.yml",
                "-f",
                "deploy/docker-compose.test.yml",
                "down",
                "-v",
            ],
            check=False,
            timeout=60,
            env=compose_env,
        )

        typer.secho("Allocating free host ports...", fg=typer.colors.CYAN)
        ports["postgres"] = find_free_port()
        ports["mongo"] = find_free_port()
        ports["http"] = find_free_port()
        ports["https"] = find_free_port()

        typer.echo(
            f"Assigned ports: Postgres={ports['postgres']}, Mongo={ports['mongo']}, HTTP={ports['http']}, HTTPS={ports['https']}"
        )

        compose_env.update(
            {
                "TEST_POSTGRES_PORT": str(ports["postgres"]),
                "TEST_MONGO_PORT": str(ports["mongo"]),
                "TEST_PROXY_PORT_HTTP": str(ports["http"]),
                "TEST_PROXY_PORT_HTTPS": str(ports["https"]),
            }
        )

        # Register temporary SSO client app with Hive
        hive_url = root_env.get("NEXT_PUBLIC_HIVE_URL", "https://hive.org")
        if not hive_url:
            typer.secho("Hive URL not found. Aborting!")
            return
        typer.secho(
            "Registering temporary SSO client with Hive...", fg=typer.colors.CYAN
        )
        client_id = None
        client_secret = None
        try:
            with HiveClient(
                "admin", "Password1", hive_url, verify=False, timeout=10
            ) as client:
                # The redirect URI must match NEXTAUTH_URL exactly, host
                # included, because Hive rejects a callback to any other
                # origin. Registering 127.0.0.3 while the app announced
                # bluz.dev left the browser parked on the login page until
                # auth.setup.ts timed out.
                sso_credentials = client.register_sso_service(
                    service_name=f"Bluz Test {slug}",
                    redirect_uris=f"https://{APP_HOST}:{ports['https']}/api/auth/callback/hive",
                )
                client_id = sso_credentials.get("client_id")
                client_secret = sso_credentials.get("client_secret")
                typer.secho(
                    f"SSO registered successfully. ID: {client_id}",
                    fg=typer.colors.GREEN,
                )
        except Exception as e:
            typer.secho(
                f"Failed to register SSO client with Hive: {e}", fg=typer.colors.RED
            )
            raise RuntimeError(f"SSO registration failed: {e}")

        # Set environment for docker compose
        assert client_id is not None and client_secret is not None, (
            "Hive SSO creds are unset!"
        )
        compose_env.update(
            {
                "TEST_HIVE_CLIENT_ID": client_id,
                "TEST_HIVE_CLIENT_SECRET": client_secret,
            }
        )

        typer.secho("Starting Docker Compose...", fg=typer.colors.CYAN)
        compose_cmd = [
            "docker",
            "compose",
            "-p",
            project_name,
            "-f",
            "deploy/docker-compose.yml",
            "-f",
            "deploy/docker-compose.test.yml",
            "up",
            "-d",
        ]
        if rebuild:
            compose_cmd.append("--build")

        subprocess.run(
            compose_cmd,
            env=compose_env,
            check=True,
            timeout=1200 if new_ui_container else 180,
        )

        typer.secho("Waiting for web application to be ready...", fg=typer.colors.CYAN)
        if wait_for_ui_ready(ports["https"], timeout=1200 if new_ui_container else 120):
            typer.secho("Web application is ready!", fg=typer.colors.GREEN)
        else:
            raise RuntimeError("Timeout waiting for application to be ready.")

    # Setup connection strings/configs for host scripts
    # Ephemeral per-run credentials for the disposable test containers — no
    # static secret to leak from the repo/CI logs.
    db_pass = root_env.get("POSTGRES_PASSWORD") or secrets.token_urlsafe(24)
    mongo_pass = root_env.get("MONGO_ROOT_PASSWORD") or secrets.token_urlsafe(24)
    db_url = f"postgres://admin:{db_pass}@127.0.0.3:{ports['postgres']}/curriculum_db"

    assert db_pass is not None, "Postgres DB password is unset!"
    test_env: dict[str, str] = {
        **merged_env,
        "DATABASE_URL": db_url,
        "POSTGRES_PASSWORD": db_pass,
        "TEST_MONGO_PASSWORD": mongo_pass,
        "MONGO_HOST": "127.0.0.3",
        "MONGO_PORT": str(ports["mongo"]),
        "BASE_URL": f"https://{APP_HOST}:{ports['https']}",
        "TEST_PROJECT_NAME": project_name,
        "TEST_POSTGRES_PORT": str(ports["postgres"]),
        "TEST_MONGO_PORT": str(ports["mongo"]),
        "TEST_PROXY_PORT_HTTP": str(ports["http"]),
        "TEST_PROXY_PORT_HTTPS": str(ports["https"]),
    }

    # Drizzle Schema Generate/Push
    typer.secho("Syncing database schema (drizzle-kit)...", fg=typer.colors.CYAN)
    typer.secho(f"Postgres DB URL: {db_url}")
    # Generate migrations first
    subprocess.run(
        "npm run db:generate", env=test_env, shell=True, check=True, timeout=60
    )
    # Push schema directly (retry to wait for PostgreSQL container to be fully ready)
    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            subprocess.run(
                "npm run db:push",
                env=test_env,
                shell=True,
                check=True,
                timeout=60,
            )
            break
        except subprocess.CalledProcessError as e:
            if attempt == max_retries:
                raise e
            typer.secho(
                f"Database not ready yet. Retrying db:push ({attempt}/{max_retries})...",
                fg=typer.colors.YELLOW,
            )
            time.sleep(3)

    # Run database seeding
    typer.secho("Seeding databases...", fg=typer.colors.CYAN)

    # Hive populate (runs Python populate script) only if requested or metadata missing
    hive_data_path = os.path.join("scripts", "demo", "hive_data.json")
    if seed_hive or not os.path.exists(hive_data_path):
        subprocess.run(
            [sys.executable, "scripts/demo/populate_demo_hive.py"],
            env=test_env,
            check=True,
            timeout=120,
        )
        typer.secho("Populated demo hive.")
    else:
        typer.secho(
            "Skipping Hive database seeding (reusing existing data).",
            fg=typer.colors.YELLOW,
        )
    # Bluz populate (runs TS populate script)
    subprocess.run(
        "npx tsx scripts/demo/populate_demo_bluz.ts",
        env=test_env,
        shell=True,
        check=True,
        timeout=120,
    )

    typer.secho(
        "Database setup and seeding completed successfully.", fg=typer.colors.GREEN
    )

    if seed_only:
        typer.secho(
            "Seed-only mode active. Skipping tests. Environment details:",
            fg=typer.colors.GREEN,
        )
        typer.echo(f"  Proxy (HTTPS):  https://127.0.0.3:{ports['https']}")
        typer.echo(f"  PostgreSQL:     127.0.0.3:{ports['postgres']}")
        typer.echo(f"  MongoDB:        127.0.0.3:{ports['mongo']}")
        return

    # Run tests via Playwright
    typer.secho("Running Playwright tests...", fg=typer.colors.CYAN)
    playwright_cmd = "npx playwright test --config tests/playwright.config.ts"
    if ui:
        playwright_cmd += " --ui"
    elif visual:
        playwright_cmd += " --headed"
        test_env["TEST_VISUAL"] = "1"

    if grep:
        playwright_cmd += f' --grep "{grep}"'

    if spec:
        playwright_cmd += f" tests/{spec}.spec.ts"

    if shard:
        playwright_cmd += f" --shard={shard}"

    result = subprocess.run(playwright_cmd, env=test_env, shell=True, timeout=600)

    if result.returncode == 0:
        typer.secho("All tests passed!", fg=typer.colors.GREEN, bold=True)
    else:
        raise RuntimeError(
            f"Playwright tests failed with exit code {result.returncode}."
        )


if __name__ == "__main__":
    app()
