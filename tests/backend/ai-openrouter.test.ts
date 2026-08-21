import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the OpenRouter provider. The two things worth pinning down
 * are the transcript → wire mapping (a tool call replayed in the wrong shape
 * is rejected by the backend) and the reassembly of tool calls that arrive a
 * few characters at a time across stream frames.
 */

import { OpenRouterProvider } from "@/api-server/ai/openrouter";
import { AiNotConfiguredError, AiProviderError } from "@/api-server/ai/provider";
import { AiMessage, AiRole } from "@/api-shared/types/ai";

const provider = new OpenRouterProvider({ apiKey: "test-key" });

/** Stubs `fetch` with a streamed SSE body built from the given frames. */
function mockStream(frames: Array<string>) {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const frame of frames) {
                controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function mockJson(payload: unknown, status = 200) {
    const fetchMock = vi.fn(
        async () =>
            new Response(JSON.stringify(payload), {
                status,
                headers: { "Content-Type": "application/json" },
            }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

/** The JSON body the provider actually sent. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
    return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
}

async function collectText(
    stream: AsyncIterable<{ kind: string }>,
): Promise<{ text: string; final: any }> {
    let text = "";
    let final: any;
    for await (const event of stream as AsyncIterable<any>) {
        if (event.kind === "text") text += event.text;
        else final = event.result;
    }
    return { text, final };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("OpenRouterProvider", () => {
    it("refuses to construct without a key", () => {
        expect(() => new OpenRouterProvider({ apiKey: "" })).toThrow(
            AiNotConfiguredError,
        );
    });

    it("sends the key as a bearer token", async () => {
        const fetchMock = mockJson({ choices: [{ message: { content: "hi" } }] });
        await provider.chat({ messages: [] });

        const headers = (fetchMock.mock.calls[0][1] as RequestInit)
            .headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer test-key");
    });

    it("maps a tool result onto the wire's tool message shape", async () => {
        const fetchMock = mockJson({ choices: [{ message: { content: "" } }] });
        const messages: Array<AiMessage> = [
            {
                role: AiRole.Assistant,
                content: "",
                toolCalls: [{ id: "c1", name: "list_events", arguments: "{}" }],
            },
            {
                role: AiRole.Tool,
                toolCallId: "c1",
                name: "list_events",
                content: "[]",
            },
        ];
        await provider.chat({ messages });

        const body = sentBody(fetchMock);
        expect(body.messages[0]).toMatchObject({
            role: "assistant",
            // An assistant turn that only called tools must send `null`, not
            // an empty string: some backends reject the latter.
            content: null,
            tool_calls: [
                {
                    id: "c1",
                    type: "function",
                    function: { name: "list_events", arguments: "{}" },
                },
            ],
        });
        expect(body.messages[1]).toMatchObject({
            role: "tool",
            tool_call_id: "c1",
            content: "[]",
        });
    });

    it("asks for usage totals only when streaming", async () => {
        const streamFetch = mockStream(['{"choices":[{"delta":{"content":"a"}}]}']);
        await collectText(provider.streamChat({ messages: [] }));
        expect(sentBody(streamFetch).stream_options).toEqual({
            include_usage: true,
        });

        vi.unstubAllGlobals();
        const jsonFetch = mockJson({ choices: [{ message: { content: "hi" } }] });
        await provider.chat({ messages: [] });
        expect(sentBody(jsonFetch).stream_options).toBeUndefined();
    });

    it("reassembles a tool call streamed one fragment at a time", async () => {
        mockStream([
            '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"list_events","arguments":"{\\"fr"}}]}}]}',
            '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"om\\":\\"x\\"}"}}]}}]}',
            '{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        ]);

        const { final } = await collectText(provider.streamChat({ messages: [] }));
        expect(final.toolCalls).toEqual([
            { id: "c1", name: "list_events", arguments: '{"from":"x"}' },
        ]);
        expect(final.finishReason).toBe("tool_calls");
    });

    it("keeps parallel tool calls apart and in index order", async () => {
        mockStream([
            '{"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"two","arguments":"{}"}}]}}]}',
            '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"one","arguments":"{}"}}]}}]}',
        ]);

        const { final } = await collectText(provider.streamChat({ messages: [] }));
        expect(final.toolCalls.map((call: { name: string }) => call.name)).toEqual([
            "one",
            "two",
        ]);
    });

    it("synthesises an id when the backend omits one", async () => {
        // The id is the handle the approval round-trip and the tool result are
        // keyed on, so an anonymous call still needs a stable one.
        mockStream([
            '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"one","arguments":"{}"}}]}}]}',
        ]);

        const { final } = await collectText(provider.streamChat({ messages: [] }));
        expect(final.toolCalls[0].id).toBe("call_0");
    });

    it("accumulates streamed text and reports usage", async () => {
        mockStream([
            '{"model":"m","choices":[{"delta":{"content":"של"}}]}',
            '{"choices":[{"delta":{"content":"ום"}}]}',
            '{"usage":{"prompt_tokens":5,"completion_tokens":7,"total_tokens":12}}',
        ]);

        const { text, final } = await collectText(
            provider.streamChat({ messages: [] }),
        );
        expect(text).toBe("שלום");
        expect(final.content).toBe("שלום");
        expect(final.model).toBe("m");
        expect(final.usage).toEqual({
            promptTokens: 5,
            completionTokens: 7,
            totalTokens: 12,
        });
    });

    it("skips a malformed frame rather than dropping the answer", async () => {
        mockStream([
            '{"choices":[{"delta":{"content":"a"}}]}',
            "{not json",
            '{"choices":[{"delta":{"content":"b"}}]}',
        ]);

        const { text } = await collectText(provider.streamChat({ messages: [] }));
        expect(text).toBe("ab");
    });

    it("raises an in-band error frame as a provider error", async () => {
        mockStream(['{"error":{"message":"rate limited"}}']);
        await expect(
            collectText(provider.streamChat({ messages: [] })),
        ).rejects.toThrow(AiProviderError);
    });

    it("treats an error body on a 200 as a failure", async () => {
        mockJson({ error: { message: "content filtered" } });
        await expect(provider.chat({ messages: [] })).rejects.toThrow(
            AiProviderError,
        );
    });

    it("does not leak the upstream error body to the caller", async () => {
        // The body can echo the prompt back; only the status may surface.
        mockJson({ error: { message: "prompt was: SECRET" } }, 429);
        await expect(provider.chat({ messages: [] })).rejects.toThrow(/429/);
        await expect(provider.chat({ messages: [] })).rejects.not.toThrow(
            /SECRET/,
        );
    });

    it("propagates an abort rather than wrapping it", async () => {
        const controller = new AbortController();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                controller.abort();
                throw new DOMException("aborted", "AbortError");
            }),
        );

        await expect(
            provider.chat({ messages: [], signal: controller.signal }),
        ).rejects.toThrow(/aborted/);
    });
});
