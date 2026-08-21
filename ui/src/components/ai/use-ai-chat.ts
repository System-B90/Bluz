"use client";

/**
 * Conversation state for the assistant panel.
 *
 * Holds two parallel things: the **transcript** replayed to the server (raw
 * `AiMessage`s, including tool calls the user never sees) and the **timeline**
 * rendered in the panel. Keeping them apart is what lets the UI show a tidy
 * chat while the model still gets its exact tool bookkeeping back.
 */

import React from "react";

import { streamAiChat } from "@/api-client/ai";
import {
    AiMessage,
    AiRole,
    AiStreamEventType,
    AiToolCall,
} from "@/api-shared/types/ai";

export enum AiTimelineKind {
    User = "user",
    Assistant = "assistant",
    Tool = "tool",
}

export type AiTimelineItem =
    | { kind: AiTimelineKind.Assistant; id: string; text: string }
    | {
          kind: AiTimelineKind.Tool;
          id: string;
          name: string;
          summary: string;
          state: "failed" | "ok" | "running";
      }
    | { kind: AiTimelineKind.User; id: string; text: string };

/** A write the model wants to make, waiting on the user. */
export type AiPendingApproval = {
    toolCallId: string;
    name: string;
    summary: string;
    arguments: unknown;
};

export type AiChatScope = {
    iterationId?: string;
    curriculumId?: string;
};

let sequence = 0;
const nextId = () => `item-${++sequence}`;

export function useAiChat(scope: AiChatScope) {
    const [timeline, setTimeline] = React.useState<Array<AiTimelineItem>>([]);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<null | string>(null);
    const [pendingApproval, setPendingApproval] =
        React.useState<AiPendingApproval | null>(null);

    // The transcript is a ref, not state: a turn appends to it while streaming
    // and every render in between would otherwise fight the update.
    const transcript = React.useRef<Array<AiMessage>>([]);
    const abortRef = React.useRef<AbortController | null>(null);

    // A live scope ref keeps `run` stable: the callback must not be rebuilt
    // (and cancel an in-flight turn) every time the user changes iteration.
    const scopeRef = React.useRef(scope);
    React.useEffect(() => {
        scopeRef.current = scope;
    }, [scope]);

    const run = React.useCallback(
        async (approvedToolCallIds: Array<string> = []) => {
            const abort = new AbortController();
            abortRef.current = abort;
            setBusy(true);
            setError(null);
            setPendingApproval(null);

            // One id per turn, so streamed deltas append to a single bubble
            // instead of creating one per chunk.
            const assistantId = nextId();
            let hasAssistantBubble = false;

            try {
                const events = streamAiChat(
                    {
                        messages: transcript.current,
                        iterationId: scopeRef.current.iterationId,
                        curriculumId: scopeRef.current.curriculumId,
                        approvedToolCallIds,
                    },
                    abort.signal,
                );

                for await (const event of events) {
                    switch (event.type) {
                    case AiStreamEventType.Delta: {
                        setTimeline((items) => {
                            if (!hasAssistantBubble) {
                                hasAssistantBubble = true;
                                return [
                                    ...items,
                                    {
                                        kind: AiTimelineKind.Assistant,
                                        id: assistantId,
                                        text: event.text,
                                    },
                                ];
                            }
                            return items.map((item) =>
                                item.id === assistantId &&
                                    item.kind === AiTimelineKind.Assistant
                                    ? { ...item, text: item.text + event.text }
                                    : item,
                            );
                        });
                        break;
                    }
                    case AiStreamEventType.ToolStart: {
                        setTimeline((items) => [
                            ...items,
                            {
                                kind: AiTimelineKind.Tool,
                                id: event.toolCallId,
                                name: event.name,
                                summary: "פועל…",
                                state: "running",
                            },
                        ]);
                        break;
                    }
                    case AiStreamEventType.ToolResult: {
                        setTimeline((items) => {
                            const existing = items.find(
                                (item) => item.id === event.toolCallId,
                            );
                            const updated: AiTimelineItem = {
                                kind: AiTimelineKind.Tool,
                                id: event.toolCallId,
                                name: event.name,
                                summary: event.summary,
                                state: event.ok ? "ok" : "failed",
                            };
                            return existing
                                ? items.map((item) =>
                                    item.id === event.toolCallId
                                        ? updated
                                        : item,
                                )
                                : [...items, updated];
                        });
                        break;
                    }
                    case AiStreamEventType.ToolProposal: {
                        setPendingApproval({
                            toolCallId: event.toolCallId,
                            name: event.name,
                            summary: event.summary,
                            arguments: event.arguments,
                        });
                        break;
                    }
                    case AiStreamEventType.Done: {
                        transcript.current = [
                            ...transcript.current,
                            ...event.messages,
                        ];
                        break;
                    }
                    case AiStreamEventType.Error: {
                        setError(event.message);
                        break;
                    }
                    }
                }
            } catch (e) {
                if (!abort.signal.aborted) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            } finally {
                abortRef.current = null;
                setBusy(false);
            }
        },
        [],
    );

    const send = React.useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || busy) return;

            transcript.current = [
                ...transcript.current,
                { role: AiRole.User, content: trimmed },
            ];
            setTimeline((items) => [
                ...items,
                { kind: AiTimelineKind.User, id: nextId(), text: trimmed },
            ]);
            void run();
        },
        [busy, run],
    );

    const approve = React.useCallback(() => {
        if (!pendingApproval) return;
        void run([pendingApproval.toolCallId]);
    }, [pendingApproval, run]);

    /**
     * Declining still has to answer the model's tool call. An unanswered call
     * would make every later request malformed, so the refusal is written into
     * the transcript as the call's result.
     */
    const reject = React.useCallback(() => {
        if (!pendingApproval) return;

        const lastAssistant = [...transcript.current]
            .reverse()
            .find((message) => message.role === AiRole.Assistant);
        const answered = new Set(
            transcript.current
                .filter((message) => message.role === AiRole.Tool)
                .map((message) => message.toolCallId),
        );
        const declined: Array<AiToolCall> = (lastAssistant?.toolCalls ?? []).filter(
            (call) => !answered.has(call.id),
        );

        transcript.current = [
            ...transcript.current,
            ...declined.map((call) => ({
                role: AiRole.Tool,
                toolCallId: call.id,
                name: call.name,
                content: JSON.stringify({
                    error: "המשתמש לא אישר את הפעולה",
                }),
            })),
        ];

        setTimeline((items) => [
            ...items,
            {
                kind: AiTimelineKind.Tool,
                id: pendingApproval.toolCallId,
                name: pendingApproval.name,
                summary: "הפעולה נדחתה",
                state: "failed",
            },
        ]);
        setPendingApproval(null);
        void run();
    }, [pendingApproval, run]);

    const stop = React.useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = React.useCallback(() => {
        abortRef.current?.abort();
        transcript.current = [];
        setTimeline([]);
        setPendingApproval(null);
        setError(null);
    }, []);

    // A turn left in flight when the panel unmounts would keep streaming into
    // dead state, and keep the upstream request billing.
    React.useEffect(() => () => abortRef.current?.abort(), []);

    return { timeline, busy, error, pendingApproval, send, approve, reject, stop, reset };
}
