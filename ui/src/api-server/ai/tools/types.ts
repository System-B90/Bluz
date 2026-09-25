/**
 * Tool contract for the AI assistant.
 *
 * A tool is the only way the model touches Bluz data. Each one wraps an
 * existing `api-server` controller rather than reaching for a database
 * directly, so the assistant is bound by exactly the same validation,
 * history-tracking and Hive sync as the REST routes and the CLI.
 */

import { DatabaseController } from "@/api-server/mongo-db-controller";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { IterationId } from "@/api-shared/types/iteration";

/**
 * Failure classes a tool can produce, chosen for what the *model* should do
 * next rather than for what went wrong internally. Two errors with the same
 * recovery path share a kind.
 */
export enum AiToolErrorKind {
    /** The model's arguments were malformed or invalid. Fix and retry. */
    InvalidArguments = "invalid_arguments",
    /** The referenced record does not exist. Re-list, do not retry as-is. */
    NotFound = "not_found",
    /** A business rule refused it. Not retryable by any phrasing. */
    Rejected = "rejected",
    /** Existing data conflicts. Needs a human decision. */
    Conflict = "conflict",
    /** A dependency is down. Retry at most once. */
    Unavailable = "unavailable",
}

/** Everything a tool may know about the session it runs in. */
export type AiToolContext = {
    /** Target iteration; undefined means the current one. */
    iterationId?: IterationId;
    /** Curriculum the user is looking at, when on a Gantt screen. */
    curriculumId?: string;
    /**
     * The moment the turn treats as "now". Defaults to the wall clock; the
     * self-test pins it so "Tuesday" resolves to the same date every run.
     */
    now?: Date;
    /** The signed-in staff member, for write attribution. */
    actor: { id: string; displayName: string };
    /** Calendar store scoped to {@link iterationId}, resolved lazily. */
    readController: () => Promise<DatabaseController>;
    /** Same, but refuses a past iteration. Write tools use this one. */
    writeController: () => Promise<DatabaseController>;
};

export type AiToolResult = {
    /** Returned to the model. Keep it compact — it is re-sent every turn. */
    data: unknown;
    /** One Hebrew line shown in the chat transcript. */
    summary: string;
};

export type AiTool<TArgs = Record<string, unknown>> = {
    /** Wire name. Shown to the model, never to a human. */
    readonly name: string;
    /**
     * Friendly Hebrew label, shown wherever a human sees this tool — the
     * timeline chip, the approval card, the capability list. Every tool has
     * one, so no screen ever has to fall back to the snake_case wire name.
     */
    readonly title: string;
    readonly description: string;
    /** Read tools run unattended; write tools need per-call human approval. */
    readonly kind: AiToolKind;
    /**
     * How much damage the call can do. Drives the approval card's severity and
     * whether a second confirmation is required.
     */
    readonly danger: AiToolDanger;
    /** JSON Schema for {@link execute}'s argument object. */
    readonly parameters: Record<string, unknown>;

    /**
     * Instructions appended to a *successful* envelope, telling the model what
     * to do with the payload it just got. Tool-specific; the generic advice
     * ("do not invent ids") is added by the envelope itself.
     */
    readonly nextSteps?: Array<string>;
    /** Recovery instructions prepended when this tool fails. */
    readonly recovery?: Array<string>;

    /**
     * Describes what running this call would do, for the approval prompt.
     * Only meaningful for {@link AiToolKind.Write}.
     */
    describe?: (args: TArgs, context: AiToolContext) => string;

    /**
     * The concrete consequences of approving, one Hebrew bullet each. The
     * human reads these, not the JSON arguments, so they must name real
     * effects ("מוחק 12 אירועים") rather than restate the call.
     */
    impact?: (args: TArgs, context: AiToolContext) => Array<string>;

    execute: (args: TArgs, context: AiToolContext) => Promise<AiToolResult>;
}
