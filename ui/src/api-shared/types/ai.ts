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
}

/** A tool as advertised to the browser (for rendering, not for calling). */
export type AiToolSummary = {
    name: string;
    description: string;
    kind: AiToolKind;
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
    | { type: AiStreamEventType.Error; message: string }
    | {
          type: AiStreamEventType.ToolProposal;
          toolCallId: string;
          name: string;
          /** Parsed arguments, for showing the human what will change. */
          arguments: unknown;
          /** Hebrew, one line: what approving this will do. */
          summary: string;
      }
    | {
          type: AiStreamEventType.ToolResult;
          toolCallId: string;
          name: string;
          summary: string;
          ok: boolean;
      }
    | { type: AiStreamEventType.ToolStart; toolCallId: string; name: string };

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
