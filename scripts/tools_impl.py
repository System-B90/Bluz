"""
Name: tools_impl.py
Purpose: Implementation for the root tools.py CLI - dev server lifecycle, status checks,
         and thin wraps around npm/docker scripts, optimized for agentic (token-efficient) use.
Created: 2026-07-06
Author: Michael K. Steinberg
"""

import socket
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import typer

app = typer.Typer(help="Bluz dev-ops helper CLI.", no_args_is_help=True)

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / "scripts" / ".tools"
DEV_PID_FILE = STATE_DIR / "dev.pid"
DEV_LOG_FILE = STATE_DIR / "dev.log"

DEV_PORT = 3000
DEV_HOST = "bluz.dev"


def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    # npm/npx on Windows are .cmd shims, not .exe -- CreateProcess can't find
    # them without going through the shell.
    shell = sys.platform == "win32" and cmd[0] in ("npm", "npx")
    return subprocess.run(cmd, cwd=ROOT, shell=shell, **kwargs)


def _spawn_background(cmd: list[str], log_file: Path, pid_file: Path) -> int:
    """Starts a detached background process, logs its output, and records its PID."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    creationflags = 0
    if sys.platform == "win32":
        creationflags = (
            subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
    shell = sys.platform == "win32" and cmd[0] in ("npm", "npx")
    with log_file.open("w", encoding="utf-8") as log:
        proc = subprocess.Popen(
            cmd,
            cwd=ROOT,
            shell=shell,
            stdout=log,
            stderr=subprocess.STDOUT,
            creationflags=creationflags,
        )
    pid_file.write_text(str(proc.pid), encoding="utf-8")
    return proc.pid


def _pid_alive(pid: int) -> bool:
    if sys.platform == "win32":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True
        )
        return str(pid) in result.stdout
    try:
        import os

        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _kill_pid(pid: int) -> None:
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
    else:
        import os
        import signal

        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass


def _read_pid(pid_file: Path) -> int | None:
    if not pid_file.exists():
        return None
    try:
        return int(pid_file.read_text(encoding="utf-8").strip())
    except ValueError:
        return None


def _port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def _https_ok(host: str) -> tuple[bool, str]:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(f"https://{host}", timeout=3, context=ctx) as resp:
            return resp.status < 500, str(resp.status)
    except urllib.error.HTTPError as e:
        return e.code < 500, str(e.code)
    except Exception as e:  # noqa: BLE001 - report any connection failure as down
        return False, str(e)


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


if __name__ == "__main__":
    app()
