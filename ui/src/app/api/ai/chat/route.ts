export const dynamic = "force-dynamic";

import { getAiProvider } from "@/api-server/ai";
import { runAiAgent } from "@/api-server/ai/agent";
import { AiProviderError } from "@/api-server/ai/provider";
import { encodeSseEvent } from "@/api-server/ai/sse";
import { AiToolContext } from "@/api-server/ai/tools";
import { parseJsonBody } from "@/api-server/common";
import {
    resolveIterationDb,
    resolveWritableIterationDb,
} from "@/api-server/mongo-db-controller";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
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
        if ((message.content?.length ?? 0) > AI_MAX_MESSAGE_LENGTH) {
            throw new ClientApiError("הודעה ארוכה מדי");
        }
        return message;
    });
}

export async function POST(request: Request): Promise<Response> {
    // Everything before the stream opens can still answer with a real status
    // code, so auth and validation happen here rather than inside the stream.
    let payload: ApiAiChatPayload;
    let context: AiToolContext;
    try {
        const user = await requireStaffSession();
        payload = parseJsonBody<ApiAiChatPayload>(await request.text());
        const messages = validateMessages(payload.messages);
        payload = { ...payload, messages };

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
        const status =
            e instanceof ClientApiError
                ? 400
                : e instanceof AiProviderError
                    ? 502
                    : 401;
        return Response.json(
            {
                status: -1,
                error: {
                    name: e instanceof Error ? e.name : "Error",
                    message: e instanceof Error ? e.message : String(e),
                },
            },
            { status },
        );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const events = runAiAgent({
                    provider: getAiProvider(),
                    messages: payload.messages,
                    context,
                    approvedToolCallIds: new Set(
                        payload.approvedToolCallIds ?? [],
                    ),
                    model: payload.model,
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
