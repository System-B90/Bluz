"""
Name: test_ai_requests.py
Purpose: Wire contracts for `bluz ai` — the capability report, the benchmark,
         and the streaming chat turn including its write-tool approval gate.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json

import pytest

from bluz_cli.errors import BluzApiError
from wire_types import Raw


def _sse(*events: dict) -> Raw:
    """Encode frames the way ui/src/api-shared/sse.ts does, plus the sentinel."""
    body = "".join(f"data: {json.dumps(event)}\n\n" for event in events)
    return Raw((body + "data: [DONE]\n\n").encode("utf-8"), "text/event-stream")


def _frames(result) -> list[dict]:
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


# --- bluz ai tools / benchmark ----------------------------------------------


def test_ai_tools_reads_the_capability_report(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/ai/tools", {"enabled": True, "model": "m", "tools": []})

    result = run_cli(stub, "ai", "tools")

    assert result.exit_code == 0
    assert stub.last().method == "GET"
    assert stub.last().path == "/api/ai/tools"


def test_ai_benchmark_posts_with_no_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/ai/benchmark", {"cases": []})

    result = run_cli(stub, "ai", "benchmark")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().path == "/api/ai/benchmark"


def test_ai_benchmark_surfaces_the_rate_limit(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/benchmark",
        {"status": 1, "error": {"name": "AiRateLimitError", "message": "once an hour"}},
        status=429,
    )

    # `run()` turns this into a styled message and exit code 1; the runner
    # invokes the app directly, so the error surfaces as the exception itself.
    with pytest.raises(BluzApiError) as raised:
        run_cli(stub, "ai", "benchmark")

    assert "once an hour" in str(raised.value)


# --- bluz ai chat ------------------------------------------------------------


def test_chat_sends_the_prompt_as_the_last_user_message(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/chat",
        _sse(
            {"type": "delta", "text": "שלום"},
            {"type": "done", "messages": [], "awaitingApproval": False, "model": "m"},
        ),
    )

    result = run_cli(stub, "ai", "chat", "מה יש היום?")

    assert result.exit_code == 0
    body = stub.last().body
    assert body["messages"] == [{"role": "user", "content": "מה יש היום?"}]
    assert "approvedToolCallIds" not in body


def test_chat_carries_scope_and_a_previous_transcript(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/chat",
        _sse({"type": "done", "messages": [], "awaitingApproval": False, "model": "m"}),
    )
    prior = json.dumps([{"role": "user", "content": "hi"}])

    result = run_cli(
        stub,
        "ai",
        "chat",
        "and then?",
        "--messages",
        prior,
        "--iteration",
        "2026a",
        "--curriculum-id",
        "c1",
        "--model",
        "custom",
    )

    assert result.exit_code == 0
    body = stub.last().body
    assert body["messages"][0] == {"role": "user", "content": "hi"}
    assert body["messages"][-1] == {"role": "user", "content": "and then?"}
    assert body["iterationId"] == "2026a"
    assert body["curriculumId"] == "c1"
    assert body["model"] == "custom"


def test_chat_streams_every_frame_in_json_mode(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/chat",
        _sse(
            {"type": "tool_start", "toolCallId": "t1", "name": "n", "title": "T"},
            {
                "type": "tool_result",
                "toolCallId": "t1",
                "name": "n",
                "title": "T",
                "summary": "ok",
                "ok": True,
            },
            {"type": "delta", "text": "done"},
            {"type": "done", "messages": [], "awaitingApproval": False, "model": "m"},
        ),
    )

    result = run_cli(stub, "ai", "chat", "q")

    assert result.exit_code == 0
    assert [frame["type"] for frame in _frames(result)] == [
        "tool_start",
        "tool_result",
        "delta",
        "done",
    ]


def test_chat_stops_on_a_pending_write_without_approving_it(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/chat",
        _sse(
            {
                "type": "tool_proposal",
                "toolCallId": "call-1",
                "name": "delete_event",
                "title": "מחיקת אירוע",
                "danger": "destructive",
                "arguments": {"id": "e1"},
                "summary": "ימחק אירוע",
            },
            {"type": "done", "messages": [], "awaitingApproval": True, "model": "m"},
        ),
    )

    result = run_cli(stub, "ai", "chat", "delete it")

    assert result.exit_code == 0
    # One turn only: the write is never let through without a human.
    assert len(stub.requests) == 1
    assert "call-1" in result.stderr


def test_chat_yes_resumes_the_turn_with_the_approved_call_id(stub_bluz, run_cli):
    stub = stub_bluz()
    calls: list = []

    first = _sse(
        {
            "type": "tool_proposal",
            "toolCallId": "call-1",
            "name": "delete_event",
            "title": "מחיקת אירוע",
            "danger": "destructive",
            "arguments": {"id": "e1"},
            "summary": "ימחק אירוע",
        },
        {
            "type": "done",
            "messages": [{"role": "assistant", "content": ""}],
            "awaitingApproval": True,
            "model": "m",
        },
    )
    second = _sse(
        {"type": "done", "messages": [], "awaitingApproval": False, "model": "m"}
    )

    # The stub answers one route per (method, path), so swap the body after
    # the first turn to script a two-turn approval round.
    original_route = stub.routes[("POST", "/api/ai/chat")] = (200, first)
    assert original_route

    class Swapping:
        def __getitem__(self, key):
            body = first if not calls else second
            calls.append(key)
            return (200, body)

        def get(self, key, default=None):
            if key != ("POST", "/api/ai/chat"):
                return default
            return self[key]

    stub.routes = Swapping()  # type: ignore[assignment]

    result = run_cli(stub, "ai", "chat", "delete it", "--yes")

    assert result.exit_code == 0
    assert len(stub.requests) == 2
    resumed = stub.requests[-1].body
    assert resumed["approvedToolCallIds"] == ["call-1"]
    # The prior turn's messages are appended, not swapped in.
    assert resumed["messages"][0] == {"role": "user", "content": "delete it"}
    assert resumed["messages"][-1] == {"role": "assistant", "content": ""}


def test_chat_reports_a_terminal_error_frame(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "POST",
        "/api/ai/chat",
        _sse({"type": "error", "message": "המודל לא זמין"}),
    )

    result = run_cli(stub, "ai", "chat", "q")

    assert result.exit_code == 0
    assert [frame["type"] for frame in _frames(result)] == ["error"]
