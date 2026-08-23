"""
Name: conftest.py
Purpose: A real local HTTP server standing in for Bluz, so CLI tests assert the
         actual request the CLI puts on the wire — path, query and JSON body —
         rather than a mock of the client.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from typer.testing import CliRunner

from bluz_cli.main import app


@dataclass
class Recorded:
    method: str
    path: str
    query: dict[str, list[str]]
    body: Any


@dataclass
class Raw:
    """A non-envelope response body sent byte-for-byte (Excel, ICS, ...)."""

    payload: bytes
    content_type: str = "application/octet-stream"


@dataclass
class StubBluz:
    """A Bluz-shaped HTTP server. Routes answer with the response envelope."""

    url: str
    requests: list[Recorded] = field(default_factory=list)
    # (method, path) -> (status, body-to-send-verbatim)
    routes: dict[tuple[str, str], tuple[int, Any]] = field(default_factory=dict)

    def route(self, method: str, path: str, body: Any, *, status: int = 200) -> None:
        self.routes[(method.upper(), path)] = (status, body)

    def envelope(self, method: str, path: str, data: Any, *, status: int = 200) -> None:
        """Register a route answering the standard { status: 0, data } envelope."""
        self.route(method, path, {"status": 0, "data": data}, status=status)

    def last(self) -> Recorded:
        assert self.requests, "the CLI made no request"
        return self.requests[-1]


@pytest.fixture
def stub_bluz():
    servers: list[ThreadingHTTPServer] = []

    def build() -> StubBluz:
        stub = StubBluz(url="")

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args: Any) -> None:
                pass

            def _handle(self) -> None:
                parsed = urlparse(self.path)
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b""
                body: Any = None
                if raw:
                    try:
                        body = json.loads(raw)
                    except ValueError:
                        body = raw.decode("utf-8", "replace")

                stub.requests.append(
                    Recorded(
                        method=self.command,
                        path=parsed.path,
                        query=parse_qs(parsed.query),
                        body=body,
                    )
                )

                status, payload = stub.routes.get(
                    (self.command, parsed.path),
                    (
                        404,
                        {
                            "status": 1,
                            "error": {"name": "NotFound", "message": parsed.path},
                        },
                    ),
                )
                if isinstance(payload, Raw):
                    encoded, content_type = payload.payload, payload.content_type
                else:
                    encoded = json.dumps(payload).encode("utf-8")
                    content_type = "application/json; charset=utf-8"
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            do_GET = _handle
            do_POST = _handle
            do_PUT = _handle
            do_PATCH = _handle
            do_DELETE = _handle

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        servers.append(server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        stub.url = f"http://127.0.0.1:{server.server_address[1]}"
        return stub

    yield build

    for server in servers:
        server.shutdown()
        server.server_close()


@pytest.fixture
def run_cli(tmp_path, monkeypatch):
    """Invokes the CLI against a stub, with config isolated to a temp dir."""
    # typer.get_app_dir reads APPDATA on Windows and HOME/XDG elsewhere, so
    # all three are redirected -- otherwise the tests would read (and could
    # write) the developer's real bluz config.
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.delenv("BLUZ_URL", raising=False)
    monkeypatch.delenv("BLUZ_TOKEN", raising=False)
    runner = CliRunner()

    def invoke(stub: StubBluz, *args: str) -> Any:
        return runner.invoke(
            app,
            ["--url", stub.url, "--token", "test-token", "--json", *args],
            catch_exceptions=False,
        )

    return invoke
