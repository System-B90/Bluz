/**
 * Browser wrapper for the AI assistant. Nothing here knows which model backend
 * answers — the route hides that entirely.
 */

import { constructErrorFromNetworkMessage } from "@/api-shared/errors";
import {
    AiStreamEvent,
    AiStreamEventType,
    ApiAiChatPayload,
} from "@/api-shared/types/ai";

const CHAT_ENDPOINT = "/api/ai/chat";
const TOOLS_ENDPOINT = "/api/ai/tools";

/**
 * Opens a turn and yields its events as they arrive.
 *
 * Errors before the stream opens surface as a thrown `ClientApiError` (the
 * route still answers a real status there); errors after it opens arrive as a
 * terminal {@link AiStreamEventType.Error} event.
 *
 * @param payload Transcript, scope, and any approved tool-call ids.
 * @param signal Aborts the turn — pass the one your "stop" button owns.
 * @example
 * ```ts
 * for await (const event of streamAiChat({ messages }, controller.signal)) {
 *     if (event.type === AiStreamEventType.Delta) append(event.text);
 * }
 * ```
 */
export async function* streamAiChat(
    payload: ApiAiChatPayload,
    signal?: AbortSignal,
): AsyncGenerator<AiStreamEvent> {
    const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
    });

    if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw constructErrorFromNetworkMessage(
            body?.error ?? { name: "Error", message: "שירות ה-AI אינו זמין" },
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Frames are `data: {...}\n\n`; a chunk can end mid-frame, so only
            // whole lines are consumed and the remainder stays buffered.
            let newline = buffer.indexOf("\n");
            while (newline !== -1) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf("\n");

                if (!line.startsWith("data:")) continue;
                yield JSON.parse(line.slice("data:".length).trim()) as AiStreamEvent;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/** Whether this deployment has AI wired up, plus what the assistant can do. */
export async function fetchAiTools(): Promise<{
    enabled: boolean;
    tools: Array<{ name: string; description: string; kind: string }>;
}> {
    const response = await fetch(TOOLS_ENDPOINT);
    if (!response.ok) return { enabled: false, tools: [] };
    const body = await response.json();
    return body?.data ?? { enabled: false, tools: [] };
}
