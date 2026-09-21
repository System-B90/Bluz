/**
 * Browser wrapper for the AI assistant. Nothing here knows which model backend
 * answers — the route hides that entirely.
 */

import { safeApiFetcher } from "@/api-client/common";
import { constructErrorFromNetworkMessage } from "@/api-shared/errors";
import { readSseData } from "@/api-shared/sse";
import {
    AiStreamEvent,
    AiStreamEventType,
    AiToolSummary,
    ApiAiChatPayload,
} from "@/api-shared/types/ai";
import { AiBenchmarkJob } from "@/api-shared/types/ai-benchmark";

const CHAT_ENDPOINT = "/api/ai/chat";
const TOOLS_ENDPOINT = "/api/ai/tools";
const BENCHMARK_ENDPOINT = "/api/ai/benchmark";

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

/**
 * Whether this deployment has AI wired up, plus what the assistant can do.
 *
 * Only a genuine "not configured" answer resolves to `enabled: false` — a
 * transient fault (5xx, network drop) throws instead, so a caller can retry
 * rather than have the assistant look permanently unavailable for a blip.
 */
export async function fetchAiTools(): Promise<{
    enabled: boolean;
    model: null | string;
    tools: Array<AiToolSummary>;
}> {
    const response = await fetch(TOOLS_ENDPOINT);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw constructErrorFromNetworkMessage(
            errorBody?.error ?? {
                name: "Error",
                message: "לא ניתן היה לבדוק את זמינות עוזר ה-AI",
            },
        );
    }
    // A 200 with a non-JSON body (proxy error page, empty response) must not
    // throw here — the launcher probes this once per mount and should just
    // stay hidden, not crash the page it's mounted on.
    const body = await response.json().catch(() => null);
    return body?.data ?? { enabled: false, model: null, tools: [] };
}

/**
 * Starts the assistant self-test in the background (#704).
 *
 * Returns at once with the job state: the run itself takes minutes, so it
 * lives on the server and is read back with {@link fetchAiBenchmarkJob}. The
 * throttle (one run per hour per user) arrives as a 429 with a readable message.
 */
export async function startAiBenchmark(
    signal?: AbortSignal,
): Promise<AiBenchmarkJob> {
    return await safeApiFetcher<AiBenchmarkJob>(BENCHMARK_ENDPOINT, {
        method: "POST",
        signal,
    });
}

/** Current state of the user's self-test run: idle, running, done or failed. */
export async function fetchAiBenchmarkJob(
    signal?: AbortSignal,
): Promise<AiBenchmarkJob> {
    return await safeApiFetcher<AiBenchmarkJob>(BENCHMARK_ENDPOINT, { signal });
}
