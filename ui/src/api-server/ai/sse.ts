/**
 * Server-Sent Events plumbing shared by the AI layer: reading an upstream
 * event stream, and writing one back to the browser.
 *
 * Kept provider-agnostic on purpose — every OpenAI-compatible backend speaks
 * this same framing, so a second provider reuses this file instead of
 * re-implementing the chunk boundary handling.
 */

import { AiStreamEvent } from "@/api-shared/types/ai";

/** Terminator every OpenAI-compatible backend sends after the last chunk. */
export const SSE_DONE_SENTINEL = "[DONE]";

/**
 * Yields the payload of each `data:` line in an SSE response body.
 *
 * Network chunks split anywhere — mid-line, mid-JSON — so the tail of a chunk
 * is buffered until a newline completes it. Comment lines (`:` prefix, used by
 * some backends as a keep-alive while a request queues) are skipped.
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

                if (!line || line.startsWith(":")) continue;
                if (!line.startsWith("data:")) continue;

                const payload = line.slice("data:".length).trim();
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

/** Serialises one {@link AiStreamEvent} as an SSE frame. */
export function encodeSseEvent(event: AiStreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}
