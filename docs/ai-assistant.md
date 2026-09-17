# AI Assistant

The floating assistant answers questions about the schedule and the Gantt, and
can change both — under a gate. This page describes the harness: how a turn
flows, what the model is told, and what stops it.

## Quick Start

```bash
# Point the deployment at a model backend
export AI_PROVIDER=openrouter          # the only provider today
export OPENROUTER_API_KEY=sk-or-...    # unset ⇒ the launcher stays hidden
export AI_MODEL=stealth/ox-alpha       # optional; provider default otherwise
export AI_BASE_URL=https://...         # optional; for a self-hosted gateway

npm run dev
# open the app, click the ✨ FAB, ask: מה יש בלו"ז השבוע?
```

Verify the configured model is actually usable:
**Settings → אישי → עוזר AI → בדוק את הסוכן שלי**.

## Anatomy of a turn

```
browser ──POST /api/ai/chat──► route ──► runAiAgent ──► provider ──► model
                                   ▲          │
                                   └── tools ◄┘
```

1. `route.ts` authenticates, validates and rate-limits, then opens an SSE
   stream. Everything after the first byte is delivered as stream frames,
   because an error past that point can no longer be an HTTP status.
2. `runAiAgent` prepends the server-owned system prompt — a client-supplied
   `system` message is rejected, never merged — and loops model → tools →
   model until the model answers, asks a question, or needs approval.
3. Each frame is an `AiStreamEvent`: `delta`, `reasoning`, `tool_start`,
   `tool_result`, `tool_proposal`, `choice`, and exactly one terminal `done`
   **or** `error`.

## The four gates

| Gate | Where | What it stops |
| --- | --- | --- |
| Session | `requireStaffSession()` | Anyone who is not staff |
| Rate limit | `rate-limit.ts` | 12 chat turns/minute; 1 self-test/hour |
| Approval | `runAiAgent` | A write running without its exact call id approved |
| Iteration cap | `AI_MAX_TOOL_ITERATIONS` | A model looping on a failing tool |

The approval gate binds the **model**, not the client: `approvedToolCallIds`
comes from the request body, so a staff session that hand-crafts a POST can
list any id. That is the same access that session already has over REST, but it
means "human-gated" is a property of a normal client, not a server guarantee
that a person clicked anything.

## Tool results are envelopes

A tool never hands the model a bare payload. `envelope.ts` wraps every outcome:

```json
{
  "ok": false,
  "tool": "delete_event",
  "summary": "אירוע e1 לא נמצא",
  "error": { "kind": "not_found", "message": "אירוע e1 לא נמצא" },
  "retryable": true,
  "next": [
    "המזהה לא קיים. הרץ שוב את כלי הקריאה המתאים כדי לקבל מזהים עדכניים.",
    "אל תקרא לכלי הזה שוב עם אותו מזהה.",
    "אל תדווח למשתמש שהפעולה הצליחה."
  ]
}
```

`next` is written as orders, not description: a model told "the id does not
exist" may or may not re-list; a model told "call the listing tool again"
reliably does. Oversized payloads are truncated and the truncation is announced
in `notes`, because a model that cannot tell 40 events from the first 40 of 900
will confidently report the wrong total.

## Adding a tool

Add it to `ui/src/api-server/ai/tools/`, then to the registry in `index.ts`.
Every tool declares:

| Field | Why it exists |
| --- | --- |
| `title` | The Hebrew label a human sees; the wire name never reaches the UI |
| `kind` | `read` runs unattended, `write` needs approval, `prompt` asks the user |
| `danger` | `safe` / `caution` / `destructive` — drives the approval card, and `destructive` requires a second click |
| `describe` | One line: what approving this call will do |
| `impact` | Bullets naming real effects ("מוחק 12 אירועים"), not a restatement of the arguments |
| `nextSteps` / `recovery` | Tool-specific guidance folded into the envelope |

A tool must call an existing `api-server` controller rather than a database
directly, so the assistant inherits the same validation, history tracking and
Hive sync as the REST routes.

## Asking instead of guessing

`ask_user` is a tool the model calls to put a question to the human with
concrete options. It never executes on the server: the agent streams a `choice`
frame, ends the turn, and the **browser** writes the chosen value back as that
call's tool result. That keeps the transcript well-formed — an unanswered tool
call makes every later request malformed.

## Self-test (#704)

`POST /api/ai/benchmark` runs a fixed suite through `runAiAgent` against a
fabricated fixture, and reports per-check pass/fail. It exists because a
gateway that silently downgrades to a weaker model still *answers*; it just
stops calling tools correctly.

- The fixture replaces the tools, not the database. Nothing in a run can reach
  real data: the tool context's controller factories throw.
- No call is ever approved, so the write tools are unreachable — and they throw
  if reached anyway.
- There is no overall "good model" badge. What counts as good enough is
  deployment-specific; the score is per check, with the expectation shown for
  each failure.
