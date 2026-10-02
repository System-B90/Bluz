"""
Name: test_acme_integration.py
Purpose: End-to-end check of ACME certificates (#803): the real proxy image,
         with nginx's built-in ACME client, serves the self-signed pair while
         the ACME server is unreachable, then gets a certificate from Pebble
         (Let's Encrypt's test ACME server) over real HTTP-01 and serves it
         without a restart.
Created: 2026-10-02
Author: Michael K. Steinberg

Needs Docker; opt in with BLUZ_ACME_IT=1 (pulls images, ~2 minutes).
"""

import json
import os
import secrets
import shutil
import subprocess
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PEBBLE = "ghcr.io/letsencrypt/pebble:2.10.1"
CURL = "curlimages/curl:8.16.0"
DOMAIN = "bluz.test"

pytestmark = pytest.mark.skipif(
    os.environ.get("BLUZ_ACME_IT") != "1" or shutil.which("docker") is None,
    reason="set BLUZ_ACME_IT=1 with Docker available to run the ACME integration test",
)


def docker(*args: str, check: bool = True) -> str:
    # MSYS_NO_PATHCONV: Git Bash would rewrite container paths like /cfg.
    result = subprocess.run(
        ["docker", *args],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "MSYS_NO_PATHCONV": "1"},
    )
    if check and result.returncode != 0:
        raise AssertionError(f"docker {' '.join(args)}\n{result.stderr}")
    return result.stdout


def logs(name: str) -> str:
    result = subprocess.run(
        ["docker", "logs", name], capture_output=True, text=True, check=False
    )
    return result.stdout + result.stderr


def openssl(*args: str) -> str:
    return subprocess.run(
        ["openssl", *args], capture_output=True, text=True, check=True
    ).stdout


@pytest.fixture
def stack(tmp_path: Path) -> Iterator[dict[str, str]]:
    tag = secrets.token_hex(4)
    net, names = f"bluz-acme-it-{tag}", []
    ssl, ca, cfg = (tmp_path / d for d in ("ssl", "ca", "cfg"))
    for d in (ssl, ca, cfg):
        d.mkdir()

    # Seed the self-signed pair the wizard writes: it serves until the issue.
    openssl(
        "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-keyout", str(ssl / "key.pem"), "-out", str(ssl / "cert.pem"),
        "-subj", "/CN=bluz-self-signed",
    )  # fmt: skip

    # Pebble's own TLS cert and CA come out of its (shell-less) image.
    cid = docker("create", PEBBLE).strip()
    docker("cp", f"{cid}:/test/certs", str(cfg))
    docker("rm", cid)
    shutil.copy(cfg / "certs" / "pebble.minica.pem", ca / "ca.pem")
    (cfg / "pebble-config.json").write_text(
        json.dumps(
            {
                "pebble": {
                    "listenAddress": "0.0.0.0:14000",
                    "managementListenAddress": "0.0.0.0:15000",
                    "certificate": "/cfg/certs/localhost/cert.pem",
                    "privateKey": "/cfg/certs/localhost/key.pem",
                    # Real HTTP-01 on port 80, like a production ACME server.
                    "httpPort": 80,
                    "tlsPort": 443,
                    "ocspResponderURL": "",
                    "externalAccountBindingRequired": False,
                }
            }
        )
    )

    docker("network", "create", net)
    proxy, pebble = f"bluz-acme-proxy-{tag}", f"bluz-acme-pebble-{tag}"
    try:
        docker("build", "-q", "-f", str(REPO / "nginx" / "Dockerfile.proxy"),
               "-t", f"bluz-proxy-acme-it:{tag}", str(REPO / "nginx"))  # fmt: skip
        names.append(proxy)
        # Pebble's certificate names `pebble`, so that is the directory host.
        docker("run", "-d", "--name", proxy, "--network", net,
               "--network-alias", DOMAIN,
               "-e", "ACME_DIRECTORY_URL=https://pebble:14000/dir",
               "-e", f"ACME_DOMAIN={DOMAIN}",
               "-e", "ACME_CA_BUNDLE=/etc/nginx/acme-ca/ca.pem",
               "-v", f"{ssl}:/etc/nginx/ssl:ro",
               "-v", f"{ca}:/etc/nginx/acme-ca:ro",
               f"bluz-proxy-acme-it:{tag}")  # fmt: skip
        names.append(pebble)
        docker("create", "--name", pebble, "--network", net,
               "--network-alias", "pebble", "-e", "PEBBLE_VA_NOSLEEP=1",
               "-v", f"{cfg}:/cfg:ro", PEBBLE, "-config", "/cfg/pebble-config.json")  # fmt: skip
        yield {"net": net, "proxy": proxy, "pebble": pebble}
    finally:
        for name in names:
            docker("rm", "-f", name, check=False)
        docker("network", "rm", net, check=False)
        docker("image", "rm", f"bluz-proxy-acme-it:{tag}", check=False)


def served_issuer(net: str) -> str:
    """The issuer line of the certificate the proxy presents for DOMAIN."""
    out = subprocess.run(
        ["docker", "run", "--rm", "--network", net, CURL,
         "-skv", "-o", "/dev/null", f"https://{DOMAIN}/"],
        capture_output=True, text=True, check=False,
    )  # fmt: skip
    return next((ln for ln in out.stderr.splitlines() if "issuer:" in ln), "")


def wait_for(predicate: Callable[[], bool], timeout: float, what: str) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(2)
    raise AssertionError(f"timed out waiting for {what}")


def test_self_signed_until_issued_then_acme(stack: dict[str, str]) -> None:
    try:
        # ACME server down: HTTPS stays up on the self-signed pair.
        wait_for(
            lambda: "bluz-self-signed" in served_issuer(stack["net"]),
            30,
            "the self-signed fallback while the ACME server is unreachable",
        )
        # It comes up: the module retries on its own and swaps in the
        # issued certificate without a restart.
        docker("start", stack["pebble"])
        wait_for(
            lambda: "Pebble" in served_issuer(stack["net"]),
            150,
            "a Pebble-issued certificate",
        )
    except AssertionError:
        print(logs(stack["proxy"]))
        print(logs(stack["pebble"]))
        raise
