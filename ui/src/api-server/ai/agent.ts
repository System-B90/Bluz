/**
 * The agent loop: model → tools → model, until the model answers in prose,
 * asks the human a question, or asks for a change that needs approval.
 *
 * The safety property this file exists to enforce: **a write tool never runs
 * unless the human approved that exact tool call id.** The model can ask; only
 * the person clicking "אישור" in the chat can make it happen.
 *
 * That gate binds the *model*, not the client: `approvedToolCallIds` and the
 * transcript both come from the request body (see `route.ts`), so a staff
 * session holder who hand-crafts a POST can list any call id here without
 * ever seeing the approval UI and run a write tool directly. That is not a
 * privilege escalation — it is exactly the REST/CLI access that session
 * already has on the underlying endpoints — but it means "human-gated" is a
 * UI property for a normal client, not a server-enforced guarantee that a
 * person clicked anything.
 *
 * Every tool outcome leaves here wrapped by `envelope.ts` rather than as a
 * bare payload, so the model is always told what to do next — including, and
 * especially, after a failure.
 */

import { AiProvider } from "@/api-server/ai/provider";
import { buildSystemPrompt } from "@/api-server/ai/system-prompt";
import {
    AiToolContext,
    AiToolRegistry,
    DEFAULT_TOOL_REGISTRY,
    isPromptTool,
    isWriteTool,
} from "@/api-server/ai/tools";
import {
    AskUserArgs,
    normalizeChoiceOptions,
} from "@/api-server/ai/tools/ask-user";
import {
    AiToolEnvelope,
    errorEnvelope,
    successEnvelope,
    unknownToolEnvelope,
} from "@/api-server/ai/tools/envelope";
import {
    AI_MAX_RESPONSE_TOKENS,
    AI_MAX_TOOL_ITERATIONS,
    AiMessage,
    AiRole,
    AiStreamEvent,
    AiStreamEventType,
    AiToolCall,
    AiUsage,
} from "@/api-shared/types/ai";
import { logger } from "@/logging/pino";

export type AiAgentRunOptions = {
    provider: AiProvider;
    /** Transcript so far, excluding the system prompt. */
    messages: Array<AiMessage>;
    context: AiToolContext;
    /** Tool call ids the human approved for this turn. */
    approvedToolCallIds: ReadonlySet<string>;
    /** Defaults to the live registry; the self-test passes fixture tools. */
    registry?: AiToolRegistry;
    model?: string;
    signal?: AbortSignal;
};

/** Parses model-authored arguments, which are not guaranteed to be valid JSON. */
function parseArguments(call: AiToolCall): Record<string, unknown> {
    if (!call.arguments.trim()) return {};
    try {
        return JSON.parse(call.arguments) as Record<string, unknown>;
    } catch {
        throw new Error(
            `ארגומנטים לא תקינים לכלי ${call.name} — לא JSON חוקי. שלח אובייקט JSON תקין.`,
        );
    }
}

/**
 * The transcript entry a tool produces. Failures are fed back as tool results
 * rather than thrown: a model that mistypes an id should get the chance to
 * correct itself, exactly as it would in a terminal.
 */
function toolMessage(call: AiToolCall, envelope: AiToolEnvelope): AiMessage {
    return {
        role: AiRole.Tool,
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(envelope),
    };
}

function addUsage(total: AiUsage | undefined, next: AiUsage | undefined) {
    if (!next) return total;
    if (!total) return { ...next };
    return {
        promptTokens: total.promptTokens + next.promptTokens,
        completionTokens: total.completionTokens + next.completionTokens,
        totalTokens: total.totalTokens + next.totalTokens,
    };
}

/**
 * Tool calls at the tail of the transcript that have no result yet — what a
 * turn resumed after an approval must run *before* talking to the model again.
 *
 * Every backend rejects a transcript containing a tool call with no matching
 * result, so leaving these unanswered would fail the next request outright.
 */
function pendingToolCalls(messages: Array<AiMessage>): Array<AiToolCall> | undefined {
    const answered = new Set(
        messages
            .filter((message) => message.role === AiRole.Tool)
            .map((message) => message.toolCallId),
    );

    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.role !== AiRole.Assistant) continue;
        const unanswered = message.toolCalls?.filter(
            (call) => !answered.has(call.id),
        );
        return unanswered?.length ? unanswered : undefined;
    }
    return undefined;
}

/**
 * Runs one turn and yields it as a stream of app-level events.
 *
 * The turn ends when the model stops calling tools, when a write needs
 * approval, when the model asks the human a question, or when
 * {@link AI_MAX_TOOL_ITERATIONS} is hit.
 */
export async function* runAiAgent(
    options: AiAgentRunOptions,
): AsyncGenerator<AiStreamEvent> {
    const {
        provider,
        context,
        approvedToolCallIds,
        signal,
        registry = DEFAULT_TOOL_REGISTRY,
    } = options;

    // The system prompt is rebuilt server-side every turn and never trusted
    // from the client, so a crafted transcript cannot rewrite the rules.
    const transcript: Array<AiMessage> = [
        { role: AiRole.System, content: buildSystemPrompt(context) },
        ...options.messages,
    ];
    /** Only what this turn added — that is what the client replays next time. */
    const produced: Array<AiMessage> = [];
    let usage: AiUsage | undefined;
    let model = options.model ?? provider.defaultModel;

    // On a resumed turn the assistant message already sits in the transcript,
    // so the loop starts at the tool step rather than at the model.
    let toolCalls = pendingToolCalls(options.messages);

    const record = (message: AiMessage) => {
        transcript.push(message);
        produced.push(message);
    };

    /** Records a failed call and reports it, in the one shape both sides use. */
    const fail = function* (
        call: AiToolCall,
        envelope: AiToolEnvelope,
    ): Generator<AiStreamEvent> {
        record(toolMessage(call, envelope));
        yield {
            type: AiStreamEventType.ToolResult,
            toolCallId: call.id,
            name: call.name,
            title: registry.title(call.name),
            summary: envelope.summary,
            ok: false,
            detail: envelope,
        };
    };

    for (let iteration = 0; iteration < AI_MAX_TOOL_ITERATIONS; iteration++) {
        if (!toolCalls) {
            let content = "";

            for await (const event of provider.streamChat({
                // A snapshot, not the live array: the loop keeps appending to
                // `transcript` while the provider is mid-request, and a
                // provider that reads its own `messages` lazily would observe
                // messages that did not exist when the call was made.
                messages: [...transcript],
                tools: registry.specs(),
                model: options.model,
                maxTokens: AI_MAX_RESPONSE_TOKENS,
                signal,
            })) {
                if (event.kind === "reasoning") {
                    yield {
                        type: AiStreamEventType.ReasoningDelta,
                        text: event.text,
                    };
                    continue;
                }
                if (event.kind === "text") {
                    yield { type: AiStreamEventType.Delta, text: event.text };
                    continue;
                }
                content = event.result.content;
                toolCalls = event.result.toolCalls;
                model = event.result.model;
                usage = addUsage(usage, event.result.usage);
            }

            record({
                role: AiRole.Assistant,
                content,
                ...(toolCalls?.length ? { toolCalls } : {}),
            });

            if (!toolCalls?.length) {
                yield {
                    type: AiStreamEventType.Done,
                    messages: produced,
                    awaitingApproval: false,
                    model,
                    usage,
                };
                return;
            }
        }

        for (const call of toolCalls) {
            const tool = registry.find(call.name);
            if (!tool) {
                yield* fail(call, unknownToolEnvelope(call.name));
                continue;
            }

            // Arguments are parsed before the approval gate so the human is
            // shown the real, structured change rather than a raw string.
            let args: Record<string, unknown>;
            try {
                args = parseArguments(call);
            } catch (e) {
                yield* fail(call, errorEnvelope(call.name, e, tool));
                continue;
            }

            if (isPromptTool(tool)) {
                // The question goes to the browser and the turn ends there.
                // The *client* writes the answer back as this call's tool
                // result, exactly as it does for a declined write — which is
                // why nothing is recorded here.
                const ask = args as AskUserArgs;
                const choiceOptions = normalizeChoiceOptions(ask.options);

                if (!ask.question || choiceOptions.length === 0) {
                    // A question with no answers is a dead end for the user;
                    // hand it back as a correctable tool error instead.
                    yield* fail(
                        call,
                        errorEnvelope(
                            call.name,
                            new Error(
                                "ask_user דורש שאלה ולפחות אפשרות בחירה אחת תקינה",
                            ),
                            tool,
                        ),
                    );
                    continue;
                }

                yield {
                    type: AiStreamEventType.Choice,
                    toolCallId: call.id,
                    question: ask.question,
                    options: choiceOptions,
                    allowFreeText: ask.allowFreeText !== false,
                };
                yield {
                    type: AiStreamEventType.Done,
                    messages: produced,
                    awaitingApproval: true,
                    model,
                    usage,
                };
                return;
            }

            if (isWriteTool(tool) && !approvedToolCallIds.has(call.id)) {
                // Stop the whole turn, not just this call: a later call in the
                // batch may depend on this one's effect, so continuing without
                // it would have the model reason about a state that never was.
                //
                // Every other unapproved write in the same batch is proposed
                // alongside it, so "fill Sunday–Thursday" is one approval of
                // five calls rather than five round trips. Nothing here runs;
                // the resumed turn executes whichever ids came back approved.
                for (const proposed of toolCalls.slice(toolCalls.indexOf(call))) {
                    const proposedTool = registry.find(proposed.name);
                    if (
                        !proposedTool ||
                        !isWriteTool(proposedTool) ||
                        approvedToolCallIds.has(proposed.id)
                    ) {
                        continue;
                    }
                    let proposedArgs: Record<string, unknown>;
                    try {
                        proposedArgs = parseArguments(proposed);
                    } catch {
                        // Reported when the resumed turn reaches it.
                        continue;
                    }
                    yield {
                        type: AiStreamEventType.ToolProposal,
                        toolCallId: proposed.id,
                        name: proposed.name,
                        title: proposedTool.title,
                        danger: proposedTool.danger,
                        arguments: proposedArgs,
                        summary:
                            proposedTool.describe?.(proposedArgs, context) ??
                            `הרצת ${proposedTool.title}`,
                        impact: proposedTool.impact?.(proposedArgs, context),
                    };
                }
                yield {
                    type: AiStreamEventType.Done,
                    messages: produced,
                    awaitingApproval: true,
                    model,
                    usage,
                };
                return;
            }

            yield {
                type: AiStreamEventType.ToolStart,
                toolCallId: call.id,
                name: call.name,
                title: tool.title,
            };

            const startedAt = Date.now();
            try {
                const result = await tool.execute(args, context);
                const envelope = successEnvelope(
                    tool,
                    result.summary,
                    result.data,
                );
                record(toolMessage(call, envelope));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    title: tool.title,
                    summary: result.summary,
                    ok: true,
                    durationMs: Date.now() - startedAt,
                    detail: envelope,
                };
            } catch (e) {
                // A tool failure is the model's problem to recover from, not a
                // 500: it is reported back in-band, with recovery
                // instructions, and the loop continues.
                logger.warn(
                    {
                        tool: call.name,
                        danger: tool.danger,
                        err: e instanceof Error ? e.message : String(e),
                    },
                    "ai: tool failed",
                );
                const envelope = errorEnvelope(call.name, e, tool);
                record(toolMessage(call, envelope));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    title: tool.title,
                    summary: envelope.summary,
                    ok: false,
                    durationMs: Date.now() - startedAt,
                    detail: envelope,
                };
            }
        }

        toolCalls = undefined;
    }

    yield {
        type: AiStreamEventType.Error,
        message: "העוזר ביצע יותר מדי צעדים ללא תשובה. נסה לנסח את הבקשה מחדש.",
        // Hitting the iteration cap does not mean nothing happened: earlier
        // calls in this turn may have already written data. Dropping
        // `produced` here would replay those tool calls (and their side
        // effects) on the client's next request.
        messages: produced,
    };
}
