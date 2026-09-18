"""
Name: ai.py
Purpose: Drive the in-app AI assistant from a terminal — capability report,
         a streaming chat turn (with the same write-tool approval gate the
         browser enforces), and the provider self-test.
         Mirrors ui/src/api-client/ai.ts.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
from typing import Any

import typer

from bluz_cli.commands._common import parse_json, show
from bluz_cli.context import state
from bluz_cli.output import console, success, warn

app = typer.Typer(help="The Bluz AI assistant.", no_args_is_help=True)

_BASE = "/api/ai"

# Frame types of the chat stream, mirroring AiStreamEventType in
# ui/src/api-shared/types/ai.ts. Spelled out here rather than imported (there
# is nothing to import from across the wire) and kept in one place so the
# renderer below never repeats a literal.
_DELTA = "delta"
_REASONING = {"reasoning", "reasoning_delta"}
_CHOICE = "choice"
_TOOL_START = "tool_start"
_TOOL_RESULT = "tool_result"
_TOOL_PROPOSAL = "tool_proposal"
_DONE = "done"
_ERROR = "error"


@app.command("tools")
def list_tools() -> None:
    """What the assistant can do, and whether AI is configured at all.

    Reports `enabled: false` on a deployment with no model key rather than
    failing — the same signal the UI uses to hide the launcher.
    """
    with state.client() as client:
        show(client.get(f"{_BASE}/tools"), title="Assistant")


@app.command("benchmark")
def benchmark() -> None:
    """Run the assistant self-test against a fabricated fixture.

    Throttled server-side to once an hour per user (a run costs real tokens),
    which comes back as an `AiRateLimitError`.
    """
    with state.client() as client:
        result = client.post(f"{_BASE}/benchmark")
    success("Benchmark finished")
    show(result, title="Benchmark")


def _proposal_line(event: dict[str, Any]) -> str:
    """One human-readable line describing a pending write-tool call."""
    arguments = event.get("arguments")
    rendered = (
        json.dumps(arguments, ensure_ascii=False) if arguments is not None else ""
    )
    return f"{event.get('title') or event.get('name')}: {event.get('summary', '')} {rendered}".strip()


def _render_stream(events, *, as_json: bool) -> dict[str, Any] | None:
    """Consume one turn's frames, printing as they arrive.

    Returns the terminal `done` frame (or None when the turn ended in an
    error), so the caller can decide whether an approval round is needed.
    """
    done: dict[str, Any] | None = None
    pending: list[dict[str, Any]] = []
    wrote_text = False

    for event in events:
        kind = event.get("type")
        if as_json:
            print(json.dumps(event, ensure_ascii=False, default=str))
        elif kind == _DELTA:
            console.print(event.get("text", ""), end="")
            wrote_text = True
        elif kind in _REASONING:
            # Reasoning is collapsed in the browser; dim it here for the same
            # reason — it is context, not the answer.
            console.print(f"[dim]{event.get('text', '')}[/dim]", end="")
        elif kind == _TOOL_START:
            console.print(f"\n[cyan]→ {event.get('title') or event.get('name')}[/cyan]")
        elif kind == _TOOL_RESULT:
            colour = "green" if event.get("ok") else "red"
            console.print(
                f"[{colour}]← {event.get('title') or event.get('name')}: "
                f"{event.get('summary', '')}[/{colour}]"
            )
        elif kind == _CHOICE:
            options = ", ".join(
                str(option.get("label")) for option in event.get("options", [])
            )
            console.print(f"\n[yellow]? {event.get('question')}[/yellow] ({options})")
        elif kind == _TOOL_PROPOSAL:
            console.print(f"\n[yellow]⚠ {_proposal_line(event)}[/yellow]")
        elif kind == _ERROR:
            if wrote_text:
                console.print()
            console.print(f"[red]✗ {event.get('message', 'Stream failed')}[/red]")

        if kind == _TOOL_PROPOSAL:
            pending.append(event)
        elif kind == _DONE:
            done = event
        elif kind == _ERROR:
            done = None

    if not as_json and wrote_text:
        console.print()
    if done is not None:
        done["_pending"] = pending
    return done


@app.command("chat")
def chat(
    prompt: str = typer.Argument(..., help="What to ask the assistant."),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration the question is about."
    ),
    curriculum_id: str = typer.Option(
        None, "--curriculum-id", help="Curriculum in view, for gantt questions."
    ),
    model: str = typer.Option(None, "--model", help="Override the server's model."),
    messages: str = typer.Option(
        None,
        "--messages",
        help="JSON array continuing a previous transcript (a `done` frame's messages).",
    ),
    approve: list[str] = typer.Option(
        None,
        "--approve",
        help="Tool-call id to approve, repeatable. An approval covers that one call.",
    ),
    yes: bool = typer.Option(
        False,
        "--yes",
        "-y",
        help="Approve every write tool the turn proposes, and resume automatically.",
    ),
) -> None:
    """Ask the assistant one question and stream the answer.

    Write tools stop the turn and wait for a human, exactly as in the browser.
    Re-run with `--approve <toolCallId>` (plus `--messages` carrying the
    transcript the `done` frame returned) to let one through, or pass `--yes`
    to approve and resume in a single invocation.
    """
    transcript = parse_json(messages, what="--messages") or []
    if not isinstance(transcript, list):
        raise typer.BadParameter("--messages must be a JSON array of messages.")

    payload: dict[str, Any] = {
        "messages": [*transcript, {"role": "user", "content": prompt}],
        "iterationId": iteration,
        "curriculumId": curriculum_id,
        "model": model,
        "approvedToolCallIds": list(approve or []),
    }
    payload = {key: value for key, value in payload.items() if value not in (None, [])}

    with state.client() as client:
        done = _render_stream(
            client.stream_sse(f"{_BASE}/chat", json=payload),
            as_json=state.as_json,
        )

        # A turn that stopped on a pending write is only half an answer. With
        # --yes, resume it immediately by replaying the transcript with the
        # proposed call ids approved; without it, say what is waiting and how.
        while done is not None and done.get("awaitingApproval"):
            pending = done.get("_pending") or []
            ids = [
                event.get("toolCallId") for event in pending if event.get("toolCallId")
            ]
            if not yes:
                warn(
                    "Turn is waiting for approval of: "
                    + ", ".join(_proposal_line(event) for event in pending)
                )
                warn(
                    "Re-run with --approve "
                    + " --approve ".join(str(i) for i in ids)
                    + " (and --messages to carry the transcript), or pass --yes."
                )
                break
            if not ids:
                break
            # The `done` frame carries the turn's *new* messages, to be
            # appended to what was sent — replacing the transcript with them
            # would drop the question the approval is about.
            payload = {
                **payload,
                "messages": [*payload["messages"], *done.get("messages", [])],
                "approvedToolCallIds": ids,
            }
            done = _render_stream(
                client.stream_sse(f"{_BASE}/chat", json=payload),
                as_json=state.as_json,
            )
