/**
 * Tool contract for the AI assistant.
 *
 * A tool is the only way the model touches Bluz data. Each one wraps an
 * existing `api-server` controller rather than reaching for a database
 * directly, so the assistant is bound by exactly the same validation,
 * history-tracking and Hive sync as the REST routes and the CLI.
 */

import { DatabaseController } from "@/api-server/mongo-db-controller";
import { AiToolKind } from "@/api-shared/types/ai";
import { IterationId } from "@/api-shared/types/iteration";

/** Everything a tool may know about the session it runs in. */
export type AiToolContext = {
    /** Target iteration; undefined means the current one. */
    iterationId?: IterationId;
    /** Curriculum the user is looking at, when on a Gantt screen. */
    curriculumId?: string;
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
    readonly name: string;
    readonly description: string;
    /** Read tools run unattended; write tools need per-call human approval. */
    readonly kind: AiToolKind;
    /** JSON Schema for {@link execute}'s argument object. */
    readonly parameters: Record<string, unknown>;

    /**
     * Describes what running this call would do, for the approval prompt.
     * Only meaningful for {@link AiToolKind.Write}.
     */
    describe?: (args: TArgs, context: AiToolContext) => string;

    execute: (args: TArgs, context: AiToolContext) => Promise<AiToolResult>;
}
