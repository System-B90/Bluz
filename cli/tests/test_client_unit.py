"""
Name: test_client_unit.py
Purpose: Unit tests for the HTTP client core (bluz_cli/client.py) — envelope
         unwrapping, error translation, redirect/401 handling and get_raw().
         Fully offline: every response comes from an httpx.MockTransport, so
         there is no server and no network.
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
from typing import Any, Callable

import httpx
import pytest

import bluz_cli.client as client_module
from bluz_cli.client import BluzClient
from bluz_cli.config import Config
from bluz_cli.errors import BluzApiError, NotAuthenticatedError


def _client(
    monkeypatch, handler: Callable[[httpx.Request], httpx.Response]
) -> BluzClient:
    """A BluzClient whose transport answers from `handler` — no network."""
    # Grab the real constructor first: patching the module attribute would
    # otherwise make this very factory call itself.
    real_client_factory = httpx.Client

    def transport_injecting_factory(**kwargs: Any) -> httpx.Client:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client_factory(**kwargs)

    monkeypatch.setattr(client_module.httpx, "Client", transport_injecting_factory)
    return BluzClient(Config(url="http://stub.test", token="tok"))


def _json_response(payload: Any, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=payload)


# --- envelope unwrapping -------------------------------------------------------


def test_success_envelope_unwraps_to_data(monkeypatch):
    client = _client(
        monkeypatch,
        lambda request: _json_response({"status": 0, "data": {"id": 7}}),
    )

    assert client.get("/api/x") == {"id": 7}


def test_error_envelope_raises_the_route_s_error_name_and_message(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            404,
            json={"status": -1, "error": {"name": "NotFound", "message": "gone"}},
        )

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get("/api/x")
    assert excinfo.value.error_name == "NotFound"
    assert excinfo.value.error_message == "gone"
    assert excinfo.value.http_status == 404


def test_error_envelope_with_a_string_error_is_wrapped_verbatim(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return _json_response({"status": -1, "error": "kaput"}, status=500)

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get("/api/x")
    # A non-object error payload is stringified under a generic name.
    assert excinfo.value.error_name == "Error"
    assert excinfo.value.error_message == "kaput"


def test_bare_json_without_a_status_key_passes_through(monkeypatch):
    """Not every endpoint speaks the envelope; a bare value is returned as-is."""
    client = _client(monkeypatch, lambda request: _json_response({"hello": 1}))

    assert client.get("/api/x") == {"hello": 1}


def test_bare_json_error_body_still_raises_http_error(monkeypatch):
    client = _client(
        monkeypatch,
        lambda request: _json_response({"detail": "nope"}, status=400),
    )

    with pytest.raises(BluzApiError) as excinfo:
        client.get("/api/x")
    assert excinfo.value.error_name == "HttpError"
    assert excinfo.value.http_status == 400


def test_non_json_error_body_becomes_an_http_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="<html>Bad Gateway</html>")

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get("/api/x")
    assert excinfo.value.error_name == "HttpError"
    assert "<html>" in excinfo.value.error_message


def test_non_json_success_body_returns_raw_bytes(monkeypatch):
    """Binary routes (Excel export) come back verbatim, not through the envelope."""
    body = b"PK\x03\x04-bytes"
    client = _client(
        monkeypatch,
        lambda request: httpx.Response(200, content=body),
    )

    assert client.get("/api/x") == body


def test_json_looking_text_is_parsed_even_without_the_content_type(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b'{"sniffed": true}',
            headers={"Content-Type": "text/plain"},
        )

    client = _client(monkeypatch, handler)

    assert client.get("/api/x") == {"sniffed": True}


def test_none_valued_query_params_are_dropped(monkeypatch):
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["query"] = request.url.query.decode()
        return _json_response({"status": 0, "data": None})

    client = _client(monkeypatch, handler)
    client.get("/api/x", params={"keep": 1, "drop": None})

    assert seen["query"] == "keep=1"


# --- auth signalling -------------------------------------------------------------


@pytest.mark.parametrize("status", [301, 302, 307])
def test_a_redirect_means_not_logged_in(monkeypatch, status):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, headers={"Location": "/login"})

    client = _client(monkeypatch, handler)

    with pytest.raises(NotAuthenticatedError):
        client.post("/api/x")


def test_401_means_not_logged_in(monkeypatch):
    client = _client(monkeypatch, lambda request: httpx.Response(401))

    with pytest.raises(NotAuthenticatedError):
        client.post("/api/x")


# --- network failures --------------------------------------------------------------


def test_a_connection_failure_becomes_a_network_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get("/api/x")
    assert excinfo.value.error_name == "NetworkError"


# --- get_raw ------------------------------------------------------------------------


def test_get_raw_parses_json_without_touching_the_envelope(monkeypatch):
    client = _client(
        monkeypatch,
        lambda request: _json_response({"status": "healthy", "checks": {}}),
    )

    assert client.get_raw("/api/health") == {"status": "healthy", "checks": {}}


def test_get_raw_redirect_also_means_not_logged_in(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "/login"})

    client = _client(monkeypatch, handler)

    with pytest.raises(NotAuthenticatedError):
        client.get_raw("/api/health")


def test_get_raw_on_401_also_means_not_logged_in(monkeypatch):
    client = _client(monkeypatch, lambda request: httpx.Response(401))

    with pytest.raises(NotAuthenticatedError):
        client.get_raw("/api/health")


def test_get_raw_network_failure_becomes_a_network_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("unreachable", request=request)

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get_raw("/api/health")
    assert excinfo.value.error_name == "NetworkError"


def test_get_raw_rejects_invalid_json(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"{not json",
            headers={"Content-Type": "application/json"},
        )

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as excinfo:
        client.get_raw("/api/health")
    assert excinfo.value.error_name == "InvalidResponse"


def test_get_raw_drops_none_params_and_keeps_the_rest(monkeypatch):
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["query"] = request.url.query.decode()
        return _json_response({})

    client = _client(monkeypatch, handler)
    client.get_raw("/api/health", params={"verbose": 1, "it": None})

    assert seen["query"] == "verbose=1"


def test_posted_json_bodies_round_trip_as_json(monkeypatch):
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _json_response({"status": 0, "data": None})

    client = _client(monkeypatch, handler)
    client.post("/api/x", json={"a": 1})

    assert seen["body"] == {"a": 1}


# --- SSE streaming -------------------------------------------------------------


def _sse_response(body: str, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status, text=body, headers={"Content-Type": "text/event-stream"}
    )


def test_stream_sse_yields_each_parsed_frame(monkeypatch):
    body = (
        'data: {"type":"delta","text":"a"}\n\ndata: {"type":"done"}\n\ndata: [DONE]\n\n'
    )
    client = _client(monkeypatch, lambda request: _sse_response(body))

    assert list(client.stream_sse("/api/ai/chat", json={})) == [
        {"type": "delta", "text": "a"},
        {"type": "done"},
    ]


def test_stream_sse_stops_at_the_done_sentinel(monkeypatch):
    body = 'data: [DONE]\n\ndata: {"type":"delta","text":"never"}\n\n'
    client = _client(monkeypatch, lambda request: _sse_response(body))

    assert list(client.stream_sse("/api/ai/chat", json={})) == []


def test_stream_sse_skips_comments_and_unparsable_frames(monkeypatch):
    # A keep-alive comment and a truncated tail must not kill a live answer.
    body = ': ping\n\ndata: {"type":"delta"}\n\ndata: {"broken\n\n'
    client = _client(monkeypatch, lambda request: _sse_response(body))

    assert list(client.stream_sse("/api/ai/chat", json={})) == [{"type": "delta"}]


def test_stream_sse_translates_a_401_into_not_authenticated(monkeypatch):
    client = _client(monkeypatch, lambda request: httpx.Response(401))

    with pytest.raises(NotAuthenticatedError):
        list(client.stream_sse("/api/ai/chat", json={}))


def test_stream_sse_raises_the_enveloped_error_of_a_failed_request(monkeypatch):
    client = _client(
        monkeypatch,
        lambda request: _json_response(
            {
                "status": 1,
                "error": {"name": "AiRateLimitError", "message": "slow down"},
            },
            429,
        ),
    )

    with pytest.raises(BluzApiError) as raised:
        list(client.stream_sse("/api/ai/chat", json={}))

    assert raised.value.error_name == "AiRateLimitError"
    assert "slow down" in str(raised.value)


def test_stream_sse_reports_a_network_failure(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    client = _client(monkeypatch, handler)

    with pytest.raises(BluzApiError) as raised:
        list(client.stream_sse("/api/ai/chat", json={}))

    assert raised.value.error_name == "NetworkError"
