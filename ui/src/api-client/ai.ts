/**
 * Browser wrapper for the AI assistant. Nothing here knows which model backend
 * answers — the route hides that entirely.
 */

import { constructErrorFromNetworkMessage } from "@/api-shared/errors";
import { readSseData } from "@/api-shared/sse";
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

    for await (const payload of readSseData(response.body)) {
        try {
            yield JSON.parse(payload) as AiStreamEvent;
        } catch {
            // One malformed frame must not kill a live answer; the rest of the
            // turn still streams.
            continue;
        }
    }
}

/** Whether this deployment has AI wired up, plus what the assistant can do. */
export async function fetchAiTools(): Promise<{
    enabled: boolean;
    tools: Array<{ name: string; description: string; kind: string }>;
}> {
    const response = await fetch(TOOLS_ENDPOINT);
    if (!response.ok) return { enabled: false, tools: [] };
    // A 200 with a non-JSON body (proxy error page, empty response) must not
    // throw here — the launcher probes this once per mount and should just
    // stay hidden, not crash the page it's mounted on.
    const body = await response.json().catch(() => null);
    return body?.data ?? { enabled: false, tools: [] };
}
