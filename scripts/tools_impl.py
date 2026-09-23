"""
Name: tools_impl.py
Purpose: Implementation for the root tools.py CLI - dev server lifecycle, status checks,
         and thin wraps around npm/docker scripts, optimized for agentic (token-efficient) use.
Created: 2026-07-06
Author: Michael K. Steinberg
"""

import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path

import sb90_devops as devops
import typer

app = typer.Typer(help="Bluz dev-ops helper CLI.", no_args_is_help=True)

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / "scripts" / ".tools"
DEV_PID_FILE = STATE_DIR / "dev.pid"
DEV_LOG_FILE = STATE_DIR / "dev.log"

DEV_PORT = 3000
DEV_HOST = "bluz.dev"

HIVE_HOST = "hive.test"
PYHIVE_REPO_URL = "https://github.com/System-B90/pyhive.git"
HIVE_STACK_CLONE = STATE_DIR / "pyhive-stack"
HIVE_REGISTRY_PREFIX = "ghcr.io/system-b90/hive"
# Must match the connection string hardcoded in deploy/docker-compose.test.yml
# (same value e2e.yml's "Generate CI .env" step uses).
CI_MONGO_PASSWORD = "4Cqoz8M7g1oYHxaOuCBsOSi7KeOvWWRP"


# These wrap sb90_devops so every call site keeps passing repo-relative paths
# instead of threading ROOT through by hand. The helper bodies themselves used
# to live here, byte-identical to madash's copy — see System-B90/Bluz#226.
def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return devops.run(cmd, cwd=ROOT, **kwargs)


def _spawn_background(cmd: list[str], log_file: Path, pid_file: Path) -> int:
    return devops.spawn_background(cmd, log_file=log_file, pid_file=pid_file, cwd=ROOT)


_pid_alive = devops.pid_alive
_kill_pid = devops.kill_pid
_read_pid = devops.read_pid
_port_in_use = devops.port_in_use
_https_ok = devops.https_ok


dev_app = typer.Typer(help="Local dev server lifecycle.", no_args_is_help=False)
app.add_typer(dev_app, name="dev")


@dev_app.callback(invoke_without_command=True)
def dev_main(
    ctx: typer.Context,
    docker: bool = typer.Option(
        False,
        "--docker",
        help="Boot the full docker compose stack (npm run docker:dev) instead of npm run dev.",
    ),
) -> None:
    """Backgrounds the existing npm dev script and returns immediately."""
    if ctx.invoked_subcommand is not None:
        return

    script = "docker:dev" if docker else "dev"
    pid = _spawn_background(["npm", "run", script], DEV_LOG_FILE, DEV_PID_FILE)
    typer.echo(f"npm:run:{script} pid={pid} log={DEV_LOG_FILE}")


@dev_app.command("status")
def dev_status() -> None:
    """Reports whether the dev server (port 3000) and HTTPS proxy (bluz.dev) are up."""
    port_up = _port_in_use(DEV_PORT)
    https_up, https_detail = _https_ok(DEV_HOST)
    typer.echo(f"next:{'up' if port_up else 'down'} port={DEV_PORT}")
    typer.echo(
        f"proxy:{'up' if https_up else 'down'} https://{DEV_HOST} -> {https_detail}"
    )
    if not (port_up and https_up):
        raise typer.Exit(1)


@dev_app.command("stop")
def dev_stop() -> None:
    """Stops the background dev process started by this tool."""
    pid = _read_pid(DEV_PID_FILE)
    stopped = bool(pid and _pid_alive(pid))
    if stopped:
        _kill_pid(pid)
    DEV_PID_FILE.unlink(missing_ok=True)
    typer.echo(f"stopped={stopped}")


docker_app = typer.Typer(help="Docker compose stack wraps.", no_args_is_help=True)
app.add_typer(docker_app, name="docker")


@docker_app.command("down")
def docker_down() -> None:
    """Stops the prod/dev docker compose stack."""
    _run(["npm", "run", "docker:down"], check=True)


@docker_app.command("nuke")
def docker_nuke() -> None:
    """Stops the stack and removes volumes (wipes local DB data)."""
    _run(["npm", "run", "docker:nuke"], check=True)


db_app = typer.Typer(help="Drizzle / seeding wraps.", no_args_is_help=True)
app.add_typer(db_app, name="db")


@db_app.command("push")
def db_push() -> None:
    """Pushes the Drizzle schema to Postgres."""
    _run(["npm", "run", "db:push"], check=True)


@db_app.command("generate")
def db_generate() -> None:
    """Generates a new SQL migration from schema changes."""
    _run(["npm", "run", "db:generate"], check=True)


@db_app.command("seed")
def db_seed() -> None:
    """Seeds demo data into Hive and Bluz."""
    _run(["npm", "run", "db:seed"], check=True)


@app.command("lint")
def lint(fix: bool = typer.Option(False, "--fix", help="Apply autofixes.")) -> None:
    """Runs ESLint over ui/."""
    _run(["npm", "run", "lint:fix" if fix else "lint"], check=True)


@app.command("test")
def test(kind: str = typer.Argument("all", help="One of: all, unit, e2e.")) -> None:
    """Runs the test suite. 'all' runs the full pipeline (scripts/run_tests.py)."""
    script = {"all": "test", "unit": "test:unit", "e2e": "test:e2e"}.get(kind)
    if script is None:
        typer.echo(f"error: unknown test kind '{kind}' (want all|unit|e2e)", err=True)
        raise typer.Exit(2)
    _run(["npm", "run", script], check=True)


def _step(msg: str) -> None:
    typer.secho(f"\n== {msg}", fg=typer.colors.CYAN, bold=True)


def _fail(msg: str) -> None:
    typer.secho(msg, fg=typer.colors.RED, err=True)
    raise typer.Exit(1)


def _check_hosts() -> None:
    """Mirrors e2e.yml's /etc/hosts mapping (hive.test + bluz.dev loopbacks).

    Hive's nginx binds 127.0.0.6 (pyhive hive-stack compose; `setup-hive`'s
    `hive-host-ip` default) so it can share the host with Bluz's proxy on
    127.0.0.3. Demanding 127.0.0.1 here made every readiness probe hit a
    loopback with nothing listening and time out after 90 attempts.
    """
    wanted = {HIVE_HOST: "127.0.0.6", DEV_HOST: "127.0.0.3"}
    missing = []
    for host, ip in wanted.items():
        try:
            resolved = socket.gethostbyname(host)
        except socket.gaierror:
            resolved = None
        if resolved != ip:
            missing.append(f"{ip} {host}")
    if missing:
        hosts_file = (
            r"C:\Windows\System32\drivers\etc\hosts"
            if sys.platform == "win32"
            else "/etc/hosts"
        )
        lines = "\n".join(f"  {line}" for line in missing)
        _fail(
            f"Missing hosts-file entries. Add to {hosts_file} (needs admin):\n{lines}"
        )


def _hive_token() -> str | None:
    """Token for ghcr.io pulls, same fallback order as CI's secrets."""
    for var in ("CLASSIC_ACCESS_TOKEN", "HIVE_REPO_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"):
        token = os.environ.get(var)
        if token:
            return token
    try:
        gh = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, check=False
        )
    except (FileNotFoundError, OSError):
        return None
    if gh.returncode == 0 and gh.stdout.strip():
        return gh.stdout.strip()
    return None


def _sync_hive_stack() -> Path:
    """Sparse-clones/refreshes pyhive's hive-stack/ (compose + .env + HIVE_SHA)."""
    if (HIVE_STACK_CLONE / ".git").exists():
        pull = subprocess.run(
            ["git", "-C", str(HIVE_STACK_CLONE), "pull", "--ff-only"],
            capture_output=True,
            text=True,
            check=False,
        )
        if pull.returncode != 0:
            typer.secho(
                "warn: could not refresh pyhive hive-stack (offline?) - using cached copy",
                fg=typer.colors.YELLOW,
            )
    else:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--filter=blob:none",
                "--sparse",
                PYHIVE_REPO_URL,
                str(HIVE_STACK_CLONE),
            ],
            check=True,
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(HIVE_STACK_CLONE),
                "sparse-checkout",
                "set",
                "--no-cone",
                "hive-stack",
            ],
            check=True,
        )
    stack = HIVE_STACK_CLONE / "hive-stack"
    if not (stack / "docker-compose.yaml").exists():
        _fail(
            "pyhive#hive-stack/docker-compose.yaml not found. "
            "Has pyhive's 'Publish Hive Images' workflow run yet?"
        )
    return stack


def _hive_compose(stack: Path, *args: str) -> list[str]:
    return ["docker", "compose", "-f", str(stack / "docker-compose.yaml"), *args]


def _pull_hive_images(stack: Path) -> None:
    """Pulls published Hive images from ghcr and retags to the compose names."""
    sha = (stack / "HIVE_SHA").read_text(encoding="utf-8").strip()
    typer.echo(f"Hive commit: {sha}")

    token = _hive_token()
    if token:
        registry_host = HIVE_REGISTRY_PREFIX.split("/")[0]
        subprocess.run(
            ["docker", "login", registry_host, "-u", "token", "--password-stdin"],
            input=token,
            text=True,
            check=True,
        )
    else:
        typer.secho(
            "warn: no GitHub token found (CLASSIC_ACCESS_TOKEN/HIVE_REPO_TOKEN/"
            "GITHUB_TOKEN/gh auth) - pulls may fail if packages are private",
            fg=typer.colors.YELLOW,
        )

    listing = subprocess.run(
        _hive_compose(stack, "config", "--images"),
        cwd=stack,
        capture_output=True,
        text=True,
        check=True,
    )
    images = sorted(
        {
            line.strip()
            for line in listing.stdout.splitlines()
            if line.strip().startswith("hive/")
        }
    )
    if not images:
        _fail(
            "No 'hive/*' images found in docker-compose.yaml - cannot map registry images."
        )

    for img in images:
        name = img.removeprefix("hive/").split(":")[0]
        remote = f"{HIVE_REGISTRY_PREFIX}/{name}:{sha}"
        cached = subprocess.run(
            ["docker", "image", "inspect", remote], capture_output=True, check=False
        )
        if cached.returncode != 0:
            typer.echo(f"Pulling {remote} -> {img}")
            subprocess.run(["docker", "pull", remote], check=True)
        else:
            typer.echo(f"Cached  {remote} -> {img}")
        subprocess.run(["docker", "tag", remote, img], check=True)


def _init_hive(stack: Path, wait_attempts: int) -> None:
    """Boots + initializes the Hive stack, mirroring setup-hive@main registry mode."""
    # Cap Hive's prod resource footprint, same as CI. docker-compose.yaml
    # loads .env.override (optional) after .env.
    (stack / ".env.override").write_text(
        "HIVE_CORE_WORKERS=2\nHIVE_CORE_THREADS=2\nHIVE_NGINX_WORKERS=1\n",
        encoding="utf-8",
    )

    def compose(*args: str, check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(_hive_compose(stack, *args), cwd=stack, check=check)

    compose("up", "-d")
    # `up -d` returns as soon as the containers start; `core` only waits for
    # `database` to be *started*, not accepting connections, so an immediate
    # `migrate` raced Postgres and died with "Connection refused" on any cold
    # boot. Wait for the server itself before touching it.
    for attempt in range(1, wait_attempts + 1):
        ready = compose("exec", "-T", "database", "pg_isready", check=False)
        if ready.returncode == 0:
            break
        typer.echo(
            f"Attempt {attempt}/{wait_attempts} - Hive database not ready, waiting 5s..."
        )
        time.sleep(5)
    else:
        _fail("Hive database failed to accept connections in time.")
    compose("exec", "-T", "core", "python", "manage.py", "migrate")
    compose("exec", "-T", "core", "python", "manage.py", "collectstatic", "--noinput")
    compose("exec", "-T", "database", "sh", "/update.sh")
    compose("exec", "-T", "core", "python", "manage.py", "service_accounts")
    compose("exec", "-T", "core", "python", "manage.py", "load_tags")
    # check=False: fails harmlessly when the superuser already exists
    # (local volumes persist across runs, unlike CI's fresh runner).
    compose(
        "exec",
        "-T",
        "-e",
        "DJANGO_SUPERUSER_USERNAME=admin",
        "-e",
        "DJANGO_SUPERUSER_PASSWORD=Password1",
        "-e",
        "DJANGO_SUPERUSER_EMAIL=admin@hive.test",
        "core",
        "python",
        "manage.py",
        "createsuperuser",
        "--noinput",
        check=False,
    )
    compose("exec", "-T", "core", "python", "manage.py", "load_programs")

    for attempt in range(1, wait_attempts + 1):
        up, detail = _https_ok(HIVE_HOST)
        if up:
            typer.secho(f"Hive is up (HTTP {detail})", fg=typer.colors.GREEN)
            return
        typer.echo(
            f"Attempt {attempt}/{wait_attempts} - Hive not ready ({detail}), waiting 5s..."
        )
        time.sleep(5)
    _fail("Hive failed to become ready in time.")


def _verify_hive_login() -> None:
    from pyhive import HiveClient

    with HiveClient(
        "admin", "Password1", f"https://{HIVE_HOST}", verify=False, timeout=30
    ) as client:
        typer.secho(
            f"Hive admin login OK. API version: {client.get_hive_version()}",
            fg=typer.colors.GREEN,
        )


def _ensure_env() -> None:
    """Generates a CI-style .env if none exists (mirrors e2e.yml). Never overwrites."""
    env_file = ROOT / ".env"
    if env_file.exists():
        typer.echo(".env exists - keeping it.")
        return
    pg_pass = secrets.token_hex(16)
    env_file.write_text(
        f"""BLUZ_VERSION=latest
WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY={secrets.token_hex(32)}
NEXT_PUBLIC_HIVE_URL=https://{HIVE_HOST}
NODE_TLS_REJECT_UNAUTHORIZED=0
NEXTAUTH_URL=https://{DEV_HOST}
NEXTAUTH_SECRET={secrets.token_hex(32)}
HIVE_CLIENT_ID=ci-placeholder
HIVE_CLIENT_SECRET=ci-placeholder
MONGO_ROOT_USER=mongo_admin
MONGO_ROOT_PASSWORD={CI_MONGO_PASSWORD}
MONGO_CONNECTION_STRING=mongodb://mongo_admin:{CI_MONGO_PASSWORD}@bluz-mongodb:27017/?authSource=admin
JWT_SECRET={secrets.token_hex(32)}
SYM_ENC_KEY={secrets.token_hex(32)}
POSTGRES_USER=admin
POSTGRES_PASSWORD={pg_pass}
POSTGRES_DB=curriculum_db
DATABASE_URL=postgres://admin:{pg_pass}@bluz-curriculum-db:5432/curriculum_db
""",
        encoding="utf-8",
    )
    typer.echo("Generated CI-style .env.")


def _ensure_certs() -> None:
    ssl_dir = ROOT / "nginx" / "ssl"
    if (ssl_dir / "cert.pem").exists() and (ssl_dir / "key.pem").exists():
        typer.echo("nginx/ssl certs exist - keeping them.")
        return
    ssl_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:4096",
            "-keyout",
            str(ssl_dir / "key.pem"),
            "-out",
            str(ssl_dir / "cert.pem"),
            "-sha256",
            "-days",
            "30",
            "-nodes",
            "-subj",
            f"/CN={DEV_HOST}",
        ],
        check=True,
    )
    typer.echo("Generated self-signed nginx/ssl certs.")


@app.command("ci")
def ci(
    skip_lint: bool = typer.Option(False, "--skip-lint", help="Skip lint checks."),
    skip_unit: bool = typer.Option(False, "--skip-unit", help="Skip unit tests."),
    skip_e2e: bool = typer.Option(False, "--skip-e2e", help="Skip the E2E suite."),
    rebuild_hive: bool = typer.Option(
        False,
        "--rebuild-hive",
        help="Re-pull and re-initialize Hive even if it's already up.",
    ),
    shard: str = typer.Option(
        None, "--shard", help="Playwright shard, e.g. '1/3' (CI runs all three)."
    ),
    wait_attempts: int = typer.Option(
        90, "--wait-attempts", help="Hive readiness attempts, 5s apart."
    ),
) -> None:
    """Runs the full GitHub CI pipeline locally: lint, unit tests, Hive setup
    (registry-cached images), env/cert bootstrap, and the E2E suite."""
    _step("Checking hosts file")
    _check_hosts()

    if not (ROOT / "node_modules").exists():
        _step("Installing Node dependencies (npm ci)")
        _run(["npm", "ci"], check=True)

    if not skip_lint:
        _step("Lint: ESLint")
        _run(["npm", "run", "lint"], check=True)
        _step("Lint: Ruff check")
        _run([sys.executable, "-m", "ruff", "check", "."], check=True)
        _step("Lint: Ruff format check")
        _run([sys.executable, "-m", "ruff", "format", "--check", "."], check=True)

    if not skip_unit:
        _step("Unit tests")
        unit_env = os.environ.copy()
        unit_env.setdefault("NEXTAUTH_SECRET", "ci_test_secret_key")
        _run(["npm", "run", "test:unit"], check=True, env=unit_env)
        _step("Unit tests: Python")
        _run([sys.executable, "-m", "pytest", "-q"], check=True)

    if skip_e2e:
        typer.secho(
            "\nCI checks passed (E2E skipped).", fg=typer.colors.GREEN, bold=True
        )
        return

    _step("Installing Python dependencies")
    _run(
        [sys.executable, "-m", "pip", "install", "-r", "scripts/requirements.txt"],
        check=True,
    )

    hive_up, _ = _https_ok(HIVE_HOST)
    if hive_up and not rebuild_hive:
        _step("Hive already up - reusing (pass --rebuild-hive to force)")
    else:
        _step("Setting up Hive (registry images)")
        stack = _sync_hive_stack()
        _pull_hive_images(stack)
        _init_hive(stack, wait_attempts)

    _step("Verifying Hive admin login")
    _verify_hive_login()

    _step("Bootstrapping .env + SSL certs")
    _ensure_env()
    _ensure_certs()

    _step("Running E2E pipeline (scripts/run_tests.py)")
    e2e_cmd = [
        sys.executable,
        "scripts/run_tests.py",
        "--seed-hive",
        "--skip-unit",
    ]
    if shard:
        e2e_cmd += ["--shard", shard]
    _run(e2e_cmd, check=True)

    typer.secho("\nLocal CI pipeline passed.", fg=typer.colors.GREEN, bold=True)


if __name__ == "__main__":
    app()
