/**
 * The agent loop: model → tools → model, until the model answers in prose or
 * asks for a change that needs a human.
 *
 * The safety property this file exists to enforce: **a write tool never runs
 * unless the human approved that exact tool call id.** The model can ask; only
 * the person clicking "אישור" in the chat can make it happen.
 */

import { AiProvider } from "@/api-server/ai/provider";
import { buildSystemPrompt } from "@/api-server/ai/system-prompt";
import { AiToolContext, findTool, isWriteTool, toolSpecs } from "@/api-server/ai/tools";
import {
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
    model?: string;
    signal?: AbortSignal;
};

/** Parses model-authored arguments, which are not guaranteed to be valid JSON. */
function parseArguments(call: AiToolCall): Record<string, unknown> {
    if (!call.arguments.trim()) return {};
    try {
        return JSON.parse(call.arguments) as Record<string, unknown>;
    } catch {
        throw new Error(`ארגומנטים לא תקינים לכלי ${call.name}`);
    }
}

/**
 * The transcript entry a tool produces. Failures are fed back as tool results
 * rather than thrown: a model that mistypes an id should get the chance to
 * correct itself, exactly as it would in a terminal.
 */
function toolMessage(call: AiToolCall, payload: unknown): AiMessage {
    return {
        role: AiRole.Tool,
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(payload),
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
 * approval, or when {@link AI_MAX_TOOL_ITERATIONS} is hit.
 */
export async function* runAiAgent(
    options: AiAgentRunOptions,
): AsyncGenerator<AiStreamEvent> {
    const { provider, context, approvedToolCallIds, signal } = options;

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

    for (let iteration = 0; iteration < AI_MAX_TOOL_ITERATIONS; iteration++) {
        if (!toolCalls) {
            let content = "";

            for await (const event of provider.streamChat({
                // A snapshot, not the live array: the loop keeps appending to
                // `transcript` while the provider is mid-request, and a
                // provider that reads its own `messages` lazily would observe
                // messages that did not exist when the call was made.
                messages: [...transcript],
                tools: toolSpecs(),
                model: options.model,
                signal,
            })) {
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
            const tool = findTool(call.name);
            if (!tool) {
                const message = `כלי לא מוכר: ${call.name}`;
                record(toolMessage(call, { error: message }));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    summary: message,
                    ok: false,
                };
                continue;
            }

            // Arguments are parsed before the approval gate so the human is
            // shown the real, structured change rather than a raw string.
            let args: Record<string, unknown>;
            try {
                args = parseArguments(call);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                record(toolMessage(call, { error: message }));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    summary: message,
                    ok: false,
                };
                continue;
            }

            if (isWriteTool(tool) && !approvedToolCallIds.has(call.id)) {
                // Stop the whole turn, not just this call: a later call in the
                // batch may depend on this one's effect, so continuing without
                // it would have the model reason about a state that never was.
                yield {
                    type: AiStreamEventType.ToolProposal,
                    toolCallId: call.id,
                    name: call.name,
                    arguments: args,
                    summary:
                        tool.describe?.(args, context) ??
                        `הרצת הכלי ${call.name}`,
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

            yield {
                type: AiStreamEventType.ToolStart,
                toolCallId: call.id,
                name: call.name,
            };

            try {
                const result = await tool.execute(args, context);
                record(toolMessage(call, result.data));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    summary: result.summary,
                    ok: true,
                };
            } catch (e) {
                // A tool failure is the model's problem to recover from, not a
                // 500: it is reported back in-band and the loop continues.
                const message = e instanceof Error ? e.message : String(e);
                logger.warn({ tool: call.name, err: message }, "ai: tool failed");
                record(toolMessage(call, { error: message }));
                yield {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: call.id,
                    name: call.name,
                    summary: message,
                    ok: false,
                };
            }
        }

        toolCalls = undefined;
    }

    yield {
        type: AiStreamEventType.Error,
        message: "העוזר ביצע יותר מדי צעדים ללא תשובה. נסה לנסח את הבקשה מחדש.",
    };
}
