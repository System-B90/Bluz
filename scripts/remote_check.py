#!/usr/bin/env python3
"""
Name: remote_check.py
Purpose: CLI tool to check status of services running on mks-srvu.
Created: 2026-06-16
Author: Michael K. Steinberg
"""

import argparse
import socket
import subprocess
import sys

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

SERVICES = [
    {"name": "Hive Postgres", "port": 5432, "type": "Database"},
    {"name": "System Postgres", "port": 5433, "type": "Database"},
    {"name": "System MongoDB", "port": 27017, "type": "Database"},
    {"name": "Hive Core API", "port": 3000, "type": "App/API"},
    {"name": "Web Proxy (Nginx)", "port": 80, "type": "Proxy"},
    {"name": "SSL Proxy (Nginx)", "port": 443, "type": "Proxy"},
]

def check_port(port: int, host: str = "127.0.0.1", timeout: float = 1.0) -> bool:
    """Check if a TCP port is open and accepting connections."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def get_process_info(proc_name: str) -> str:
    """Find process IDs running on the machine for a given name."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", proc_name],
            capture_output=True,
            text=True,
            check=False
        )
        pids = result.stdout.strip().replace("\n", ", ")
        return pids if pids else "Not Found"
    except Exception:
        return "Unknown"

def main():
    parser = argparse.ArgumentParser(description="Check services running on mks-srvu remote host.")
    parser.add_argument("--host", default="127.0.0.1", help="Target hostname to check ports on.")
    parser.add_argument("--json", action="store_true", help="Output status in JSON format.")
    args = parser.parse_args()

    if args.json:
        import json
        results = []
        for svc in SERVICES:
            is_up = check_port(svc["port"], host=args.host)
            results.append({
                "service": svc["name"],
                "port": svc["port"],
                "type": svc["type"],
                "status": "UP" if is_up else "DOWN"
            })
        print(json.dumps(results, indent=2))
        return

    print(f"\n{BOLD}{CYAN}=== mks-srvu Service Status Checker ==={RESET}\n")
    print(f"{BOLD}{'Service Name':<25} | {'Port':<6} | {'Type':<10} | {'Port Status':<12} | {'PIDs':<15}{RESET}")
    print("-" * 75)

    for svc in SERVICES:
        is_up = check_port(svc["port"], host=args.host)
        status_str = f"{GREEN}UP (Open){RESET}" if is_up else f"{RED}DOWN (Closed){RESET}"
        
        # Determine process search string
        search_str = svc["name"].lower()
        if "postgres" in search_str:
            pids = get_process_info("postgres")
        elif "mongo" in search_str:
            pids = get_process_info("mongod")
        elif "nginx" in search_str:
            pids = get_process_info("nginx")
        elif "core" in search_str:
            pids = get_process_info("node")
        else:
            pids = "N/A"

        print(f"{svc['name']:<25} | {svc['port']:<6} | {svc['type']:<10} | {status_str:<21} | {pids:<15}")
    
    print()

if __name__ == "__main__":
    main()
