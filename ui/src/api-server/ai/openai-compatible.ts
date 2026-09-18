/**
 * Generic OpenAI "Chat Completions" wire client, written against the raw HTTP
 * API with `fetch`. No vendor SDK by design: OpenRouter, OpenAI itself, and
 * most self-hosted gateways (vLLM, llama.cpp server, and similar) all speak
 * this exact request/response shape — dropping one for another is a base-URL
 * change, not a dependency migration.
 *
 * {@link OpenRouterProvider} and {@link OpenAiProvider} are both thin
 * wrappers around this class; the wire handling lives here once.
 */

import {
    AiChatRequest,
    AiNotConfiguredError,
    AiProvider,
    AiProviderError,
    AiProviderEvent,
    AiToolSpec,
} from "@/api-server/ai/provider";
import { readSseData } from "@/api-shared/sse";
import {
    AiChatResult,
    AiMessage,
    AiRole,
    AiToolCall,
    AiUsage,
} from "@/api-shared/types/ai";
import { logger } from "@/logging/pino";

/** The slice of the upstream wire format this module actually reads. */
type WireToolCall = {
    /** Present on every frame in a non-streamed response, absent mid-stream. */
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
};
/**
 * Reasoning models on this wire format put their chain-of-thought in a
 * separate field alongside `content`, under one of two field names depending
 * on the backend: DeepSeek/most self-hosted gateways use
 * `reasoning_content`, OpenRouter uses `reasoning`. Both are read.
 */
type WireChoice = {
    message?: {
        content?: null | string;
        reasoning_content?: null | string;
        reasoning?: null | string;
        tool_calls?: Array<WireToolCall>;
    };
    delta?: {
        content?: null | string;
        reasoning_content?: null | string;
        reasoning?: null | string;
        tool_calls?: Array<WireToolCall>;
    };
    finish_reason?: null | string;
};
type WireUsage = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
};
type WireResponse = {
    model?: string;
    choices?: Array<WireChoice>;
    usage?: WireUsage;
    error?: { message?: string; code?: number };
};

function toUsage(usage?: WireUsage): AiUsage | undefined {
    if (!usage) return undefined;
    return {
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
    };
}

/** Maps Bluz's transcript onto the wire's message shape. */
function toWireMessages(messages: Array<AiMessage>): Array<unknown> {
    return messages.map((message) => {
        if (message.role === AiRole.Tool) {
            return {
                role: "tool",
                tool_call_id: message.toolCallId,
                name: message.name,
                content: message.content,
            };
        }
        if (message.role === AiRole.Assistant && message.toolCalls?.length) {
            return {
                role: "assistant",
                content: message.content || null,
                tool_calls: message.toolCalls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: { name: call.name, arguments: call.arguments },
                })),
            };
        }
        return { role: message.role, content: message.content };
    });
}

function toWireTools(tools: Array<AiToolSpec>): Array<unknown> {
    return tools.map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}

/**
 * Reassembles tool calls that arrive split across stream frames. The backend
 * sends one call's `arguments` a few characters at a time, keyed by `index`,
 * with `id` and `name` only on the first frame of each call.
 */
class ToolCallAccumulator {
    private readonly byIndex = new Map<
        number,
        { id: string; name: string; arguments: string }
    >();

    add(deltas: Array<WireToolCall> | undefined): void {
        if (!deltas) return;
        for (const [position, delta] of deltas.entries()) {
            const index = delta.index ?? position;
            const existing = this.byIndex.get(index) ?? {
                id: "",
                name: "",
                arguments: "",
            };
            this.byIndex.set(index, {
                id: delta.id ?? existing.id,
                name: delta.function?.name ?? existing.name,
                arguments: existing.arguments + (delta.function?.arguments ?? ""),
            });
        }
    }

    /** @returns The completed calls in emission order, or undefined if none. */
    collect(): Array<AiToolCall> | undefined {
        if (this.byIndex.size === 0) return undefined;
        return [...this.byIndex.entries()]
            .sort(([a], [b]) => a - b)
            .map(([index, call]) => ({
                // A backend that omits ids still needs a stable handle for the
                // approval round-trip and for pairing the tool result.
                id: call.id || `call_${index}`,
                name: call.name,
                arguments: call.arguments,
            }));
    }
}

export class OpenAiCompatibleProvider implements AiProvider {
    readonly name: string;
    readonly defaultModel: string;

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly extraHeaders: Record<string, string>;

    constructor(options: {
        /** Identifier reported in logs/`AI_PROVIDER` (e.g. "openrouter", "openai"). */
        name: string;
        apiKey: string;
        /** Error shown when `apiKey` is empty — names the env var operators set. */
        missingKeyMessage: string;
        baseUrl: string;
        defaultModel: string;
        /** e.g. OpenRouter's attribution headers. Omitted entries are skipped. */
        extraHeaders?: Record<string, string | undefined>;
    }) {
        if (!options.apiKey) {
            throw new AiNotConfiguredError(options.missingKeyMessage);
        }
        this.name = options.name;
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.defaultModel = options.defaultModel;
        this.extraHeaders = Object.fromEntries(
            Object.entries(options.extraHeaders ?? {}).filter(
                (entry): entry is [string, string] => Boolean(entry[1]),
            ),
        );
    }

    async chat(request: AiChatRequest): Promise<AiChatResult> {
        const response = await this.post(request, false);
        const data = (await response.json()) as WireResponse;

        // A 200 can still carry an error body when the model rejects
        // mid-flight, so the payload is checked as well as the status.
        if (data.error) {
            throw new AiProviderError(data.error.message ?? "שגיאת שירות AI");
        }

        const choice = data.choices?.[0];
        const accumulator = new ToolCallAccumulator();
        accumulator.add(choice?.message?.tool_calls);

        return {
            content: choice?.message?.content ?? "",
            toolCalls: accumulator.collect(),
            model: data.model ?? request.model ?? this.defaultModel,
            usage: toUsage(data.usage),
            finishReason: choice?.finish_reason ?? undefined,
        };
    }

    async *streamChat(
        request: AiChatRequest,
    ): AsyncIterable<AiProviderEvent> {
        const response = await this.post(request, true);
        if (!response.body) {
            throw new AiProviderError("שירות ה-AI לא החזיר תוכן");
        }

        let model = request.model ?? this.defaultModel;
        let usage: AiUsage | undefined;
        let finishReason: string | undefined;
        let content = "";
        const toolCalls = new ToolCallAccumulator();

        for await (const payload of readSseData(response.body)) {
            let chunk: WireResponse;
            try {
                chunk = JSON.parse(payload) as WireResponse;
            } catch {
                // One malformed frame is not worth killing a live answer over;
                // the stream keeps its remaining chunks.
                logger.warn({ payload }, "ai: unparsable stream frame");
                continue;
            }

            if (chunk.error) {
                throw new AiProviderError(
                    chunk.error.message ?? "שגיאת שירות AI",
                );
            }
            if (chunk.model) model = chunk.model;
            if (chunk.usage) usage = toUsage(chunk.usage);

            const choice = chunk.choices?.[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            toolCalls.add(choice?.delta?.tool_calls);

            const reasoning =
                choice?.delta?.reasoning_content ?? choice?.delta?.reasoning;
            if (reasoning) {
                yield { kind: "reasoning", text: reasoning };
            }

            const text = choice?.delta?.content;
            if (text) {
                content += text;
                yield { kind: "text", text };
            }
        }

        yield {
            kind: "final",
            result: {
                content,
                toolCalls: toolCalls.collect(),
                model,
                usage,
                finishReason,
            },
        };
    }

    private async post(
        request: AiChatRequest,
        stream: boolean,
    ): Promise<Response> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...this.extraHeaders,
        };

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers,
                signal: request.signal,
                body: JSON.stringify({
                    model: request.model ?? this.defaultModel,
                    messages: toWireMessages(request.messages),
                    stream,
                    temperature: request.temperature,
                    max_tokens: request.maxTokens,
                    ...(request.tools?.length
                        ? { tools: toWireTools(request.tools) }
                        : {}),
                    // Usage totals are omitted from streamed responses unless
                    // asked for; without this the final frame carries no cost.
                    ...(stream
                        ? { stream_options: { include_usage: true } }
                        : {}),
                }),
            });
        } catch (e) {
            if (request.signal?.aborted) throw e;
            throw new AiProviderError(
                `לא ניתן להתחבר לשירות ה-AI: ${e instanceof Error ? e.message : String(e)}`,
            );
        }

        if (!response.ok) {
            // The upstream body may echo the prompt back; it is logged for
            // operators and never returned to the browser.
            const detail = await response.text().catch(() => "");
            logger.error(
                { status: response.status, detail },
                "ai: upstream rejected request",
            );
            // This path never changes, so a 404 here always means the
            // requested model slug is unknown, retired, or misspelled.
            // Naming it saves a trip to the server logs for the single most
            // common misconfiguration.
            const message = response.status === 404
                ? `המודל "${request.model ?? this.defaultModel}" אינו קיים אצל ספק ה-AI (404). בדוק את שם המודל בהגדרות.`
                : `שירות ה-AI החזיר שגיאה (${response.status})`;
            throw new AiProviderError(message, response.status);
        }

        return response;
    }
}
