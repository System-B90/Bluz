/**
 * Domain contract for Bluz's AI assistant. Shared by `api-client` and
 * `api-server`, so it must stay free of side effects and of anything that only
 * exists on one side of the wire.
 *
 * Nothing here names a vendor: the backend model is expected to change, and a
 * provider swap must not ripple into route handlers, components, or types.
 */

/** Who produced a message in a conversation. */
export enum AiRole {
    /** Standing instructions. At most one, first in the list. */
    System = "system",
    /** Written by the human. */
    User = "user",
    /** Written by the model — may carry tool calls instead of text. */
    Assistant = "assistant",
    /** The result of running one tool the assistant asked for. */
    Tool = "tool",
}

/**
 * A tool invocation requested by the model. `arguments` stays a raw JSON
 * string, exactly as the model emitted it: it is not always valid JSON, and
 * the transcript replayed on the next turn must be byte-identical to what the
 * backend produced.
 */
export type AiToolCall = {
    id: string;
    name: string;
    arguments: string;
};

export type AiMessage = {
    role: AiRole;
    /** Empty on an assistant turn that only requested tools. */
    content: string;
    /** Assistant turns only. */
    toolCalls?: Array<AiToolCall>;
    /** Tool turns only — which call this answers. */
    toolCallId?: string;
    /** Tool turns only, for rendering the transcript. */
    name?: string;
};

/**
 * Whether running a tool changes stored data. Read tools run unattended;
 * write tools stop the turn and wait for the human to approve the exact call.
 */
export enum AiToolKind {
    Read = "read",
    Write = "write",
    /**
     * Not a data operation at all: the tool's whole effect is to put a
     * question to the human and stop the turn. Answered by the client, never
     * executed on the server.
     */
    Prompt = "prompt",
}

/**
 * How much damage running a tool can do. Drives the colour, the wording and
 * the extra confirmation on the approval card — a reversible edit and an
 * irreversible delete must not look alike.
 */
export enum AiToolDanger {
    /** Reads only, or a write that loses nothing. */
    Safe = "safe",
    /** Changes stored data; recoverable through history. */
    Caution = "caution",
    /** Destroys or overwrites data at scale. Needs an explicit re-confirm. */
    Destructive = "destructive",
}

/** A tool as advertised to the browser (for rendering, not for calling). */
export type AiToolSummary = {
    name: string;
    /** Friendly Hebrew label. The raw `name` is never shown to a user. */
    title: string;
    description: string;
    kind: AiToolKind;
    danger: AiToolDanger;
};

/** One selectable answer in an {@link AiStreamEventType.Choice} prompt. */
export type AiChoiceOption = {
    /** Sent back to the model verbatim. */
    value: string;
    /** Hebrew label on the button. */
    label: string;
    /** Optional one-line clarification under the label. */
    description?: string;
};

/** Request body of `POST /api/ai/chat`. */
export type ApiAiChatPayload = {
    /**
     * Full transcript, oldest first, excluding the system prompt — the server
     * owns that. Replay whatever the previous turn's `Done` event returned so
     * assistant tool calls and their results stay paired.
     */
    messages: Array<AiMessage>;
    /** The iteration the questions are about. Omitted means the current one. */
    iterationId?: string;
    /** Curriculum in view, if the user is on a Gantt screen. */
    curriculumId?: string;
    /**
     * Tool-call ids the human approved. A write tool runs only when its id is
     * listed here, so an approval covers one specific call and nothing else.
     */
    approvedToolCallIds?: Array<string>;
    /** Overrides the server default; normally unset so no vendor slug leaks. */
    model?: string;
};

export type AiUsage = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};

/**
 * Non-streaming result. The streaming route is the default path, but the
 * provider interface also answers in one shot for server-side callers (jobs,
 * CLI) that have nothing to stream to.
 */
export type AiChatResult = {
    content: string;
    toolCalls?: Array<AiToolCall>;
    model: string;
    usage?: AiUsage;
    /** Why generation ended — e.g. `stop`, `tool_calls`, `length`. */
    finishReason?: string;
};

export enum AiStreamEventType {
    /** A fragment of the assistant's visible answer. */
    Delta = "delta",
    /**
     * A fragment of the model's private reasoning. Rendered collapsed: it is
     * what makes an answer trustworthy, and noise the rest of the time.
     */
    Reasoning = "reasoning",
    /**
     * A fragment of a reasoning model's chain-of-thought, sent on a wire
     * channel separate from the visible answer. Shown collapsed by default.
     */
    ReasoningDelta = "reasoning_delta",
    /** The model is asking the human to pick between options. */
    Choice = "choice",
    /** A read tool started running. */
    ToolStart = "tool_start",
    /** A read tool finished; carries a short human-readable summary. */
    ToolResult = "tool_result",
    /** A write tool needs the human to approve it before it runs. */
    ToolProposal = "tool_proposal",
    /** Terminal success frame. */
    Done = "done",
    /** Terminal failure frame. */
    Error = "error",
}

/**
 * One frame of a streamed turn. A turn ends with exactly one `Done` **or**
 * one `Error`, never both.
 */
export type AiStreamEvent =
    | {
          type: AiStreamEventType.Choice;
          /** The `ask_user` call this answers; the client writes its result. */
          toolCallId: string;
          question: string;
          options: Array<AiChoiceOption>;
          /** Whether the human may type an answer instead of picking one. */
          allowFreeText: boolean;
      }
    | { type: AiStreamEventType.Delta; text: string }
    | {
          type: AiStreamEventType.Done;
          /**
           * The turn's new messages, to be appended to the transcript and
           * replayed on the next request. Includes assistant tool calls and
           * their tool results so an approved call resumes with its context.
           */
          messages: Array<AiMessage>;
          /** True when the turn stopped on a pending write approval. */
          awaitingApproval: boolean;
          model: string;
          usage?: AiUsage;
      }
    | {
          type: AiStreamEventType.Error;
          message: string;
          /**
           * The turn's produced messages so far, if any tool calls ran before
           * the failure. Optional: a pre-stream failure (auth, validation)
           * has none. When present the client should still append it to the
           * transcript before showing the error, so a retried turn does not
           * replay tool calls the server already executed.
           */
          messages?: Array<AiMessage>;
      }
    | { type: AiStreamEventType.Reasoning; text: string }
    | { type: AiStreamEventType.ReasoningDelta; text: string }
    | {
          type: AiStreamEventType.ToolProposal;
          toolCallId: string;
          name: string;
          /** Friendly Hebrew label for {@link name}. */
          title: string;
          danger: AiToolDanger;
          /** Parsed arguments, for showing the human what will change. */
          arguments: unknown;
          /** Hebrew, one line: what approving this will do. */
          summary: string;
          /** Hebrew bullets: the concrete consequences of approving. */
          impact?: Array<string>;
      }
    | {
          type: AiStreamEventType.ToolResult;
          toolCallId: string;
          name: string;
          title: string;
          summary: string;
          ok: boolean;
          /** Wall-clock duration of the call, for the timeline chip. */
          durationMs?: number;
          /** The envelope handed to the model, for the details panel. */
          detail?: unknown;
      }
    | {
          type: AiStreamEventType.ToolStart;
          toolCallId: string;
          name: string;
          title: string;
      };

/** Content type of the streaming chat route. */
export const AI_STREAM_CONTENT_TYPE = "text/event-stream";

/** Message cap per request — a guard against an unbounded prompt bill. */
export const AI_MAX_MESSAGES = 60;

/** Character cap on a single message's content. */
export const AI_MAX_MESSAGE_LENGTH = 16_000;

/**
 * Ceiling on tool round-trips inside one turn. A model that loops on a failing
 * tool would otherwise bill indefinitely.
 */
export const AI_MAX_TOOL_ITERATIONS = 8;

/**
 * Upstream completion cap, sent as `max_tokens` on every model call. Without
 * it a runaway or adversarial prompt has no ceiling on the bill for a single
 * response.
 */
export const AI_MAX_RESPONSE_TOKENS = 2_000;

/**
 * Character cap on one tool result before it is truncated. A tool that hands
 * the model a 200KB curriculum tree spends the whole context window on a
 * single call — and bills it again on every later turn of the conversation.
 */
export const AI_MAX_TOOL_RESULT_CHARS = 12_000;

/**
 * Starter prompts on the empty chat. The self-test keys a case by each one
 * (`SUGGESTED_PROMPT_CASES`), so a new chip without a case fails typecheck.
 */
export const AI_SUGGESTED_PROMPTS = [
    'מה יש בלו"ז השבוע?',
    "מי מבזר השבוע?",
    "תוסיף הפסקות בין שיעורים",
] as const;

export type AiSuggestedPrompt = (typeof AI_SUGGESTED_PROMPTS)[number];
