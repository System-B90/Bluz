#!/usr/bin/env python3
"""
Name: remote_check.py
Purpose: CLI tool to check status of services running on mks-srvu using Typer and InquirerPy.
Created: 2026-06-16
Author: Michael K. Steinberg
"""

import socket
import subprocess
import typer
from InquirerPy import inquirer

app = typer.Typer(help="mks-srvu service status checker CLI.")

# Services configuration
SERVICES = {
    "Hive Postgres (Port 5432)": {"port": 5432, "proc": "postgres"},
    "System Postgres (Port 5433)": {"port": 5433, "proc": "postgres"},
    "System MongoDB (Port 27017)": {"port": 27017, "proc": "mongod"},
    "Hive Core API (Port 3000)": {"port": 3000, "proc": "node"},
    "Web Proxy Nginx (Port 80)": {"port": 80, "proc": "nginx"},
    "SSL Proxy Nginx (Port 443)": {"port": 443, "proc": "nginx"},
}


def check_port(port: int, host: str = "127.0.0.1", timeout: float = 1.0) -> bool:
    """Check if TCP port is open."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def get_pids(proc_name: str) -> str:
    """Get PIDs of a process by name using pgrep."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", proc_name], capture_output=True, text=True, check=False
        )
        pids = result.stdout.strip().replace("\n", ", ")
        return pids if pids else "Not Found"
    except Exception:
        return "Unknown"


@app.command()
def check(
    host: str = typer.Option("127.0.0.1", help="Target hostname to check ports on."),
    interactive: bool = typer.Option(
        False, "--interactive", "-i", help="Select services interactively."
    ),
):
    """Check the status of services on the host."""
    selected_names = list(SERVICES.keys())

    if interactive:
        selected_names = inquirer.checkbox(
            message="Select services to verify:",
            choices=selected_names,
            default=selected_names,
        ).execute()

    if not selected_names:
        typer.secho("No services selected. Exiting.", fg=typer.colors.YELLOW)
        raise typer.Exit()

    typer.secho(
        "\n=== Service Verification Results ===", fg=typer.colors.CYAN, bold=True
    )

    # Table headers
    headers = f"{'Service Name':<30} | {'Port':<6} | {'Port Status':<12} | {'PIDs':<15}"
    typer.echo("-" * len(headers))
    typer.echo(headers)
    typer.echo("-" * len(headers))

    for name in selected_names:
        cfg = SERVICES[name]
        port = cfg["port"]
        proc = cfg["proc"]

        is_up = check_port(port, host=host)
        status_color = typer.colors.GREEN if is_up else typer.colors.RED
        status_text = "UP (Open)" if is_up else "DOWN (Closed)"

        pids = get_pids(proc)

        # Format and display row
        colored_status = typer.style(f"{status_text:<12}", fg=status_color)
        typer.echo(f"{name:<30} | {port:<6} | {colored_status} | {pids:<15}")

    typer.echo("-" * len(headers))
    typer.echo("")


if __name__ == "__main__":
    app()
