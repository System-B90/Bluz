"""
Name: test_acme_integration.py
Purpose: End-to-end check of ACME certificates (#803): Pebble (Let's Encrypt's
         test ACME server) issues a certificate over real HTTP-01 through the
         real proxy image, the certbot sidecar script installs it into the ssl
         dir, and the proxy reloads.
Created: 2026-10-02
Author: Michael K. Steinberg

Needs Docker; opt in with BLUZ_ACME_IT=1 (pulls images, ~1 minute).
"""

import json
import os
import secrets
import shutil
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PEBBLE = "ghcr.io/letsencrypt/pebble:latest"
CERTBOT = "certbot/certbot:v3.3.0"
DOMAIN = "bluz.test"

pytestmark = pytest.mark.skipif(
    os.environ.get("BLUZ_ACME_IT") != "1" or shutil.which("docker") is None,
    reason="set BLUZ_ACME_IT=1 with Docker available to run the ACME integration test",
)


def docker(*args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["docker", *args], capture_output=True, text=True, check=False
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
def stack(tmp_path: Path) -> Iterator[dict[str, Path | str]]:
    tag = secrets.token_hex(4)
    net, names = f"bluz-acme-it-{tag}", []
    ssl, webroot, le, ca, cfg = (
        tmp_path / d for d in ("ssl", "webroot", "letsencrypt", "ca", "cfg")
    )
    for d in (ssl, webroot, le, ca, cfg):
        d.mkdir()

    # Seed the self-signed pair the wizard writes, so nginx can start.
    openssl(
        "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-keyout", str(ssl / "key.pem"), "-out", str(ssl / "cert.pem"),
        "-subj", f"/CN={DOMAIN}",
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
    try:
        docker("build", "-q", "-f", str(REPO / "nginx" / "Dockerfile.proxy"),
               "-t", f"bluz-proxy-acme-it:{tag}", str(REPO / "nginx"))  # fmt: skip
        names.append(f"bluz-acme-proxy-{tag}")
        docker("run", "-d", "--name", names[-1], "--network", net,
               "--network-alias", DOMAIN, "-e", "CERT_WATCH_SECONDS=2",
               "-v", f"{ssl}:/etc/nginx/ssl:ro", "-v", f"{webroot}:/var/www/acme:ro",
               f"bluz-proxy-acme-it:{tag}")  # fmt: skip
        names.append(f"bluz-acme-pebble-{tag}")
        docker("run", "-d", "--name", names[-1], "--network", net,
               "--network-alias", "pebble", "-e", "PEBBLE_VA_NOSLEEP=1",
               "-v", f"{cfg}:/cfg:ro", PEBBLE, "-config", "/cfg/pebble-config.json")  # fmt: skip
        names.append(f"bluz-acme-certbot-{tag}")
        docker("run", "-d", "--name", names[-1], "--network", net,
               "--entrypoint", "/bin/sh",
               "-e", "ACME_DIRECTORY_URL=https://pebble:14000/dir",
               "-e", f"ACME_DOMAIN={DOMAIN}",
               "-e", "REQUESTS_CA_BUNDLE=/etc/bluz/acme-ca/ca.pem",
               "-v", f"{REPO / 'deploy' / 'acme' / 'acme-renew.sh'}:/acme/acme-renew.sh:ro",
               "-v", f"{le}:/etc/letsencrypt", "-v", f"{webroot}:/var/www/acme",
               "-v", f"{ca}:/etc/bluz/acme-ca:ro", "-v", f"{ssl}:/etc/nginx/ssl",
               CERTBOT, "/acme/acme-renew.sh")  # fmt: skip
        yield {"ssl": ssl, "proxy": names[0], "certbot": names[2]}
    finally:
        for name in names:
            docker("rm", "-f", name, check=False)
        docker("network", "rm", net, check=False)
        docker("image", "rm", f"bluz-proxy-acme-it:{tag}", check=False)


def wait_for(predicate, timeout: float, what: str) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(1)
    raise AssertionError(f"timed out waiting for {what}")


def test_certificate_issued_installed_and_reloaded(stack) -> None:
    cert = Path(stack["ssl"]) / "cert.pem"

    def issued_by_pebble() -> bool:
        issuer = openssl("x509", "-in", str(cert), "-noout", "-issuer")
        return "Pebble" in issuer

    try:
        wait_for(issued_by_pebble, 120, "a Pebble-issued certificate in nginx/ssl")
        subject_alt = openssl(
            "x509", "-in", str(cert), "-noout", "-ext", "subjectAltName"
        )
        assert DOMAIN in subject_alt
        wait_for(
            lambda: "certificate changed, nginx reloaded" in logs(str(stack["proxy"])),
            30,
            "the proxy to reload on the new certificate",
        )
    except AssertionError:
        print(logs(str(stack["certbot"])))
        print(logs(str(stack["proxy"])))
        raise
