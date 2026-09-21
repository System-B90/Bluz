export const dynamic = "force-dynamic";

import { getAiProvider } from "@/api-server/ai";
import { runAiAgent } from "@/api-server/ai/agent";
import { AiProviderError } from "@/api-server/ai/provider";
import { allowAiRequest } from "@/api-server/ai/rate-limit";
import { AiToolContext } from "@/api-server/ai/tools";
import {
    ApiErrorMaker,
    catchHandler,
    requireJsonObjectBody,
} from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    resolveIterationDb,
    resolveWritableIterationDb,
} from "@/api-server/mongo-db-controller";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { encodeSseEvent } from "@/api-shared/sse";
import {
    AI_MAX_MESSAGES,
    AI_MAX_MESSAGE_LENGTH,
    AI_STREAM_CONTENT_TYPE,
    AiMessage,
    AiRole,
    AiStreamEventType,
    ApiAiChatPayload,
} from "@/api-shared/types/ai";
import { logger } from "@/logging/pino";

/**
 * Streaming chat endpoint for the in-app assistant.
 *
 * Unlike every other route here it does not use `withApi`: the body is an SSE
 * stream, so an error raised after the first byte cannot become an HTTP status
 * and is delivered as a terminal `error` frame instead.
 */

/**
 * How often an SSE comment ping is sent toward the browser while a turn is
 * quiet (model still thinking, no delta/tool frame to emit). Comfortably
 * under nginx's default 60s `proxy_read_timeout` for `/api/`.
 */
const AI_KEEPALIVE_INTERVAL_MS = 20_000;

/**
 * Validates the client transcript. The system prompt is server-owned, so a
 * client-supplied `system` message is rejected rather than merged — otherwise
 * the caller could rewrite the assistant's rules.
 */
function validateMessages(messages: unknown): Array<AiMessage> {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new ClientApiError("לא נשלחו הודעות");
    }
    if (messages.length > AI_MAX_MESSAGES) {
        throw new ClientApiError(
            `שיחה ארוכה מדי (מקסימום ${AI_MAX_MESSAGES} הודעות). פתח שיחה חדשה.`,
        );
    }

    return messages.map((raw) => {
        const message = raw as AiMessage;
        if (message?.role === AiRole.System) {
            throw new ClientApiError("הודעת מערכת אינה מותרת מהלקוח");
        }
        if (!Object.values(AiRole).includes(message?.role)) {
            throw new ClientApiError("תפקיד הודעה לא תקין");
        }
        // `content` is forwarded to the provider verbatim, so its *type* has to
        // be checked and not just its length: an array of objects has no
        // `.length` worth trusting and would sail past a size-only guard.
        if (typeof message.content !== "string") {
            throw new ClientApiError("תוכן הודעה לא תקין");
        }
        if (message.content.length > AI_MAX_MESSAGE_LENGTH) {
            throw new ClientApiError("הודעה ארוכה מדי");
        }
        // Tool arguments are replayed from a previous turn and are otherwise
        // unbounded, which would make the size cap trivially bypassable by
        // stuffing them instead of the message body.
        const toolCallBytes = (message.toolCalls ?? []).reduce(
            (total, call) => total + (call?.arguments?.length ?? 0),
            0,
        );
        if (toolCallBytes > AI_MAX_MESSAGE_LENGTH) {
            throw new ClientApiError("קריאות הכלים בהודעה ארוכות מדי");
        }
        return message;
    });
}

/**
 * Validates the shape of `approvedToolCallIds` before it reaches `new
 * Set(...)` inside the stream body. Any non-array iterable (a string, an
 * object with a `length`) would otherwise sail past the `?? []` fallback and
 * throw once the stream has already opened, turning a caller mistake into a
 * 500 instead of a 400.
 */
function validateApprovedToolCallIds(value: unknown): Array<string> {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
        throw new ClientApiError("מזהי אישור לא תקינים");
    }
    return value;
}

export async function POST(request: Request): Promise<Response> {
    // Everything before the stream opens can still answer with a real status
    // code, so auth and validation happen here rather than inside the stream.
    let payload: ApiAiChatPayload;
    let context: AiToolContext;
    let apiKeyOverride: string | undefined;
    try {
        const user = await requireStaffSession();
        const personalSettings = await DbPersonalSettings.get(String(user.id));
        apiKeyOverride = personalSettings.aiApiToken || undefined;
        if (!allowAiRequest(String(user.id))) {
            return ApiErrorMaker(
                {
                    name: "AiRateLimitError",
                    message: "יותר מדי בקשות. נסה שוב בעוד דקה.",
                },
                429,
            );
        }
        payload = await requireJsonObjectBody<ApiAiChatPayload>(request);
        const messages = validateMessages(payload.messages);
        const approvedToolCallIds = validateApprovedToolCallIds(
            payload.approvedToolCallIds,
        );
        // `model` is client-controllable but never trusted: forwarding it
        // would let any staff session pick (and bill) an arbitrary OpenRouter
        // slug. The server always uses its own configured default.
        payload = {
            ...payload,
            messages,
            approvedToolCallIds,
            model: undefined,
        };

        context = {
            iterationId: payload.iterationId,
            curriculumId: payload.curriculumId,
            actor: {
                id: String(user.id),
                displayName: user.display_name || user.name || "משתמש",
            },
            readController: () => resolveIterationDb(payload.iterationId),
            writeController: () =>
                resolveWritableIterationDb(payload.iterationId),
        };
    } catch (e) {
        // `catchHandler` owns the error → status mapping for every route here,
        // including the ordering that matters: `UserNotLoggedInError` and
        // `ForbiddenError` both extend `ClientApiError`, so a hand-rolled
        // ladder that tests the base class first answers 400 for an
        // unauthenticated caller.
        if (e instanceof AiProviderError) {
            return ApiErrorMaker({ name: e.name, message: e.message }, 502);
        }
        return catchHandler(request as never, e);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            // Upstream sends its own keep-alive comments while the model
            // queues, but `readSseData` swallows them as pure transport
            // noise and nothing re-emits an equivalent toward the browser.
            // Behind nginx's default 60s proxy_read_timeout a slow model
            // (>60s to first token) then has the proxy sever the stream
            // mid-turn. This timer owns keeping the browser leg alive
            // instead, independent of whatever the upstream does.
            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": keepalive\n\n"));
                } catch {
                    // Controller already closed (turn finished between the
                    // tick firing and this line); nothing to do.
                }
            }, AI_KEEPALIVE_INTERVAL_MS);

            try {
                const events = runAiAgent({
                    provider: getAiProvider(apiKeyOverride),
                    messages: payload.messages,
                    context,
                    approvedToolCallIds: new Set(
                        payload.approvedToolCallIds ?? [],
                    ),
                    signal: request.signal,
                });

                for await (const event of events) {
                    controller.enqueue(encoder.encode(encodeSseEvent(event)));
                }
            } catch (e) {
                // The browser going away aborts the upstream fetch; that is a
                // normal end of stream, not an error worth reporting.
                if (request.signal.aborted) return;

                const message =
                    e instanceof AiProviderError || e instanceof ClientApiError
                        ? e.message
                        : "שגיאה פנימית בשירות ה-AI";
                logger.error({ err: e }, "ai: chat stream failed");
                controller.enqueue(
                    encoder.encode(
                        encodeSseEvent({
                            type: AiStreamEventType.Error,
                            message,
                        }),
                    ),
                );
            } finally {
                clearInterval(keepalive);
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": AI_STREAM_CONTENT_TYPE,
            "Cache-Control": "no-store",
            Connection: "keep-alive",
            // Nginx buffers proxied responses by default, which would hold the
            // whole answer back until the turn ends.
            "X-Accel-Buffering": "no",
        },
    });
}
