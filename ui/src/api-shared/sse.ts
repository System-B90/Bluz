/**
 * Server-Sent Events framing, shared by both sides of the wire.
 *
 * Transport-only and free of side effects, so it belongs here rather than in
 * `api-server`: the provider reads an upstream SSE stream with it, and the
 * browser reads Bluz's own stream with the same code. Two copies of chunk
 * boundary handling is one copy too many — the subtle part is that a network
 * chunk can end mid-line, and getting that wrong drops frames only under load.
 */

/** Terminator every OpenAI-compatible backend sends after the last chunk. */
export const SSE_DONE_SENTINEL = "[DONE]";

const DATA_PREFIX = "data:";

/**
 * Yields the payload of each `data:` line in an SSE body.
 *
 * The tail of a chunk is buffered until a newline completes it. Comment lines
 * (`:` prefix, used by some backends as a keep-alive while a request queues)
 * are skipped, and the stream ends at {@link SSE_DONE_SENTINEL}.
 *
 * @param body A response body stream.
 * @example
 * ```ts
 * for await (const payload of readSseData(response.body)) {
 *     handle(JSON.parse(payload));
 * }
 * ```
 */
export async function* readSseData(
    body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newline = buffer.indexOf("\n");
            while (newline !== -1) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf("\n");

                if (!line || !line.startsWith(DATA_PREFIX)) continue;

                const payload = line.slice(DATA_PREFIX.length).trim();
                if (payload === SSE_DONE_SENTINEL) return;
                yield payload;
            }
        }
    } finally {
        // Releasing the lock lets the runtime tear the socket down when the
        // consumer breaks out early (browser disconnect, abort).
        reader.releaseLock();
    }
}

/** Serialises one JSON-serialisable event as an SSE frame. */
export function encodeSseEvent(event: unknown): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}
