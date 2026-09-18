"use client";

/**
 * Conversation state for the assistant panel.
 *
 * Holds two parallel things: the **transcript** replayed to the server (raw
 * `AiMessage`s, including tool calls the user never sees) and the **timeline**
 * rendered in the panel. Keeping them apart is what lets the UI show a tidy
 * chat while the model still gets its exact tool bookkeeping back.
 *
 * The timeline is strictly append-ordered: every event the server streams
 * lands at the end of the list as it arrives, and an assistant bubble is
 * *closed* as soon as anything else happens. That is what makes a turn read in
 * the order it actually occurred — "checked the schedule → found a clash →
 * here is what I suggest" — instead of collapsing all the prose into one
 * bubble with the tool chips stranded after it.
 */

import React from "react";

import { streamAiChat } from "@/api-client/ai";
import {
    AiChoiceOption,
    AiMessage,
    AiRole,
    AiStreamEventType,
    AiToolCall,
    AiToolDanger,
    AiUsage,
} from "@/api-shared/types/ai";

export enum AiTimelineKind {
    User = "user",
    Assistant = "assistant",
    /** The model's private reasoning, rendered collapsed. */
    Thinking = "thinking",
    Tool = "tool",
    /** A write waiting on the human — shown in place, not in a floating bar. */
    Approval = "approval",
    /** A question from the model with buttons to answer it. */
    Choice = "choice",
    /** A failed turn, kept in place so the history stays truthful. */
    Failure = "failure",
}

export enum AiToolState {
    Running = "running",
    Ok = "ok",
    Failed = "failed",
}

export enum AiApprovalState {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected",
}

export type AiTimelineItem =
    | {
          kind: AiTimelineKind.Approval;
          id: string;
          toolCallId: string;
          name: string;
          title: string;
          danger: AiToolDanger;
          summary: string;
          impact: Array<string>;
          arguments: unknown;
          state: AiApprovalState;
      }
    | { kind: AiTimelineKind.Assistant; id: string; text: string }
    | {
          kind: AiTimelineKind.Choice;
          id: string;
          toolCallId: string;
          question: string;
          options: Array<AiChoiceOption>;
          allowFreeText: boolean;
          /** Set once answered; the buttons become a read-only record. */
          answer?: string;
      }
    | { kind: AiTimelineKind.Failure; id: string; message: string }
    | { kind: AiTimelineKind.Thinking; id: string; text: string }
    | {
          kind: AiTimelineKind.Tool;
          id: string;
          name: string;
          title: string;
          summary: string;
          state: AiToolState;
          durationMs?: number;
          /** The envelope the model received, for the details disclosure. */
          detail?: unknown;
      }
    | { kind: AiTimelineKind.User; id: string; text: string };

export type AiChatScope = {
    iterationId?: string;
    curriculumId?: string;
};

/** Cumulative cost of the conversation, for the panel's footer. */
export type AiChatStats = {
    model?: string;
    usage?: AiUsage;
    turns: number;
};

let sequence = 0;
const nextId = () => `item-${++sequence}`;

/** The result a client-authored tool message carries back to the model. */
function clientToolEnvelope(
    name: string,
    payload: Record<string, unknown>,
): string {
    return JSON.stringify({ ok: true, tool: name, ...payload });
}

export function useAiChat(scope: AiChatScope) {
    const [timeline, setTimeline] = React.useState<Array<AiTimelineItem>>([]);
    const [busy, setBusy] = React.useState(false);
    const [stats, setStats] = React.useState<AiChatStats>({ turns: 0 });

    // The transcript is a ref, not state: a turn appends to it while streaming
    // and every render in between would otherwise fight the update.
    const transcript = React.useRef<Array<AiMessage>>([]);
    const abortRef = React.useRef<AbortController | null>(null);
    // Guards run() against reentrancy: `busy` is state and only visible after
    // a render, so two clicks inside the same tick (e.g. a double-fired
    // approve) would both read `busy === false` and both start a POST. The
    // ref is set synchronously, before any await, so the second call sees it.
    const runningRef = React.useRef(false);

    // A live scope ref keeps `run` stable: the callback must not be rebuilt
    // (and cancel an in-flight turn) every time the user changes iteration.
    const scopeRef = React.useRef(scope);
    React.useEffect(() => {
        scopeRef.current = scope;
    }, [scope]);

    const run = React.useCallback(
        async (approvedToolCallIds: Array<string> = []) => {
            if (runningRef.current) return;
            runningRef.current = true;

            const abort = new AbortController();
            abortRef.current = abort;
            setBusy(true);

            // Mirrored outside `timeline` state so an abort can synthesize the
            // turn's assistant message without waiting on a render.
            let assistantText = "";
            const pendingToolCalls = new Map<string, string>();

            // The id of the bubble deltas currently append to. Cleared by any
            // other event, which is what starts a new bubble after a tool ran
            // — the whole reason the timeline reads chronologically.
            let openAssistantId: null | string = null;
            let openThinkingId: null | string = null;

            /** Appends, or extends the open bubble of that kind if there is one. */
            const appendText = (
                kind: AiTimelineKind.Assistant | AiTimelineKind.Thinking,
                openId: null | string,
                text: string,
            ): string => {
                const id = openId ?? nextId();
                setTimeline((items) =>
                    // Whether the bubble exists is derived from the list
                    // itself, never from a flag closed over by the updater:
                    // React double-invokes updaters under Strict Mode and
                    // keeps the second result, so a mutated flag would swallow
                    // the first delta and every one after it would find
                    // nothing to append to.
                    items.some((item) => item.id === id)
                        ? items.map((item) =>
                            item.id === id &&
                              (item.kind === AiTimelineKind.Assistant ||
                                  item.kind === AiTimelineKind.Thinking)
                                ? { ...item, text: item.text + text }
                                : item,
                        )
                        : [...items, { kind, id, text } as AiTimelineItem],
                );
                return id;
            };

            const append = (item: AiTimelineItem) => {
                openAssistantId = null;
                openThinkingId = null;
                setTimeline((items) => [...items, item]);
            };

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
                        assistantText += event.text;
                        openThinkingId = null;
                        openAssistantId = appendText(
                            AiTimelineKind.Assistant,
                            openAssistantId,
                            event.text,
                        );
                        break;
                    }
                    case AiStreamEventType.Reasoning: {
                        // Reasoning never enters the transcript: it is not
                        // part of the answer, and replaying it would bill the
                        // model to re-read its own scratchpad every turn.
                        openAssistantId = null;
                        openThinkingId = appendText(
                            AiTimelineKind.Thinking,
                            openThinkingId,
                            event.text,
                        );
                        break;
                    }
                    case AiStreamEventType.ReasoningDelta: {
                        // Same wire channel as Reasoning above, delivered in
                        // fragments instead of one block — same Thinking
                        // bubble either way.
                        openAssistantId = null;
                        openThinkingId = appendText(
                            AiTimelineKind.Thinking,
                            openThinkingId,
                            event.text,
                        );
                        break;
                    }
                    case AiStreamEventType.ToolStart: {
                        pendingToolCalls.set(event.toolCallId, event.name);
                        append({
                            kind: AiTimelineKind.Tool,
                            id: event.toolCallId,
                            name: event.name,
                            title: event.title,
                            summary: "פועל…",
                            state: AiToolState.Running,
                        });
                        break;
                    }
                    case AiStreamEventType.ToolResult: {
                        pendingToolCalls.delete(event.toolCallId);
                        const updated: AiTimelineItem = {
                            kind: AiTimelineKind.Tool,
                            id: event.toolCallId,
                            name: event.name,
                            title: event.title,
                            summary: event.summary,
                            state: event.ok
                                ? AiToolState.Ok
                                : AiToolState.Failed,
                            durationMs: event.durationMs,
                            detail: event.detail,
                        };
                        openAssistantId = null;
                        openThinkingId = null;
                        setTimeline((items) =>
                            items.some(
                                (item) => item.id === event.toolCallId,
                            )
                                ? items.map((item) =>
                                    item.id === event.toolCallId
                                        ? updated
                                        : item,
                                )
                                : [...items, updated],
                        );
                        break;
                    }
                    case AiStreamEventType.ToolProposal: {
                        append({
                            kind: AiTimelineKind.Approval,
                            id: `approval-${event.toolCallId}`,
                            toolCallId: event.toolCallId,
                            name: event.name,
                            title: event.title,
                            danger: event.danger,
                            summary: event.summary,
                            impact: event.impact ?? [],
                            arguments: event.arguments,
                            state: AiApprovalState.Pending,
                        });
                        break;
                    }
                    case AiStreamEventType.Choice: {
                        append({
                            kind: AiTimelineKind.Choice,
                            id: `choice-${event.toolCallId}`,
                            toolCallId: event.toolCallId,
                            question: event.question,
                            options: event.options,
                            allowFreeText: event.allowFreeText,
                        });
                        break;
                    }
                    case AiStreamEventType.Done: {
                        transcript.current = [
                            ...transcript.current,
                            ...event.messages,
                        ];
                        setStats((previous) => ({
                            model: event.model,
                            turns: previous.turns + 1,
                            usage: event.usage
                                ? {
                                    promptTokens:
                                          (previous.usage?.promptTokens ?? 0) +
                                          event.usage.promptTokens,
                                    completionTokens:
                                          (previous.usage?.completionTokens ??
                                              0) + event.usage.completionTokens,
                                    totalTokens:
                                          (previous.usage?.totalTokens ?? 0) +
                                          event.usage.totalTokens,
                                }
                                : previous.usage,
                        }));
                        break;
                    }
                    case AiStreamEventType.Error: {
                        // A mid-turn failure (e.g. the iteration cap) can
                        // still carry tool calls the server already
                        // executed. Dropping them here would have the next
                        // turn replay — and re-run — those same writes.
                        if (event.messages?.length) {
                            transcript.current = [
                                ...transcript.current,
                                ...event.messages,
                            ];
                        }
                        append({
                            kind: AiTimelineKind.Failure,
                            id: nextId(),
                            message: event.message,
                        });
                        break;
                    }
                    }
                }
            } catch (e) {
                if (!abort.signal.aborted) {
                    setTimeline((items) => [
                        ...items,
                        {
                            kind: AiTimelineKind.Failure,
                            id: nextId(),
                            message:
                                e instanceof Error ? e.message : String(e),
                        },
                    ]);
                } else if (assistantText || pendingToolCalls.size > 0) {
                    // No `Done` event arrives on abort, so the transcript
                    // never learns about this turn unless synthesized here —
                    // otherwise the model's own context loses whatever it
                    // already streamed, even though it stays on screen.
                    const toolCalls: Array<AiToolCall> = [...pendingToolCalls].map(
                        ([id, name]) => ({ id, name, arguments: "{}" }),
                    );
                    transcript.current = [
                        ...transcript.current,
                        {
                            role: AiRole.Assistant,
                            content: assistantText,
                            ...(toolCalls.length ? { toolCalls } : {}),
                        },
                        ...toolCalls.map((call) => ({
                            role: AiRole.Tool,
                            toolCallId: call.id,
                            name: call.name,
                            content: JSON.stringify({
                                ok: false,
                                tool: call.name,
                                error: {
                                    kind: "rejected",
                                    message: "הופסק על ידי המשתמש",
                                },
                                retryable: false,
                                next: [
                                    "המשתמש עצר את הפעולה. שאל אותו איך להמשיך.",
                                ],
                            }),
                        })),
                    ];

                    // A chip left spinning after a stop is a lie about what
                    // the server is doing.
                    setTimeline((items) =>
                        items.map((item) =>
                            item.kind === AiTimelineKind.Tool &&
                            item.state === AiToolState.Running
                                ? {
                                    ...item,
                                    state: AiToolState.Failed,
                                    summary: "הופסק",
                                }
                                : item,
                        ),
                    );
                }
            } finally {
                abortRef.current = null;
                runningRef.current = false;
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

    /** The write currently awaiting a decision, if any. */
    const pendingApproval = React.useMemo(
        () =>
            timeline.find(
                (item): item is Extract<
                    AiTimelineItem,
                    { kind: AiTimelineKind.Approval }
                > =>
                    item.kind === AiTimelineKind.Approval &&
                    item.state === AiApprovalState.Pending,
            ),
        [timeline],
    );

    /** The question currently awaiting an answer, if any. */
    const pendingChoice = React.useMemo(
        () =>
            timeline.find(
                (item): item is Extract<
                    AiTimelineItem,
                    { kind: AiTimelineKind.Choice }
                > =>
                    item.kind === AiTimelineKind.Choice &&
                    item.answer === undefined,
            ),
        [timeline],
    );

    const settleApproval = React.useCallback(
        (toolCallId: string, state: AiApprovalState) => {
            setTimeline((items) =>
                items.map((item) =>
                    item.kind === AiTimelineKind.Approval &&
                    item.toolCallId === toolCallId
                        ? { ...item, state }
                        : item,
                ),
            );
        },
        [],
    );

    const approve = React.useCallback(() => {
        if (!pendingApproval || busy) return;
        settleApproval(pendingApproval.toolCallId, AiApprovalState.Approved);
        void run([pendingApproval.toolCallId]);
    }, [pendingApproval, busy, run, settleApproval]);

    /**
     * Answers every tool call the model made but never got a result for.
     *
     * An unanswered call makes every later request malformed, so a declined
     * write and an answered question both have to be written into the
     * transcript as that call's result before the next turn opens.
     */
    const answerPendingCalls = React.useCallback(
        (contentFor: (call: AiToolCall) => string) => {
            const lastAssistant = [...transcript.current]
                .reverse()
                .find((message) => message.role === AiRole.Assistant);
            const answered = new Set(
                transcript.current
                    .filter((message) => message.role === AiRole.Tool)
                    .map((message) => message.toolCallId),
            );
            const unanswered = (lastAssistant?.toolCalls ?? []).filter(
                (call) => !answered.has(call.id),
            );

            transcript.current = [
                ...transcript.current,
                ...unanswered.map((call) => ({
                    role: AiRole.Tool,
                    toolCallId: call.id,
                    name: call.name,
                    content: contentFor(call),
                })),
            ];
        },
        [],
    );

    const reject = React.useCallback(() => {
        if (!pendingApproval || busy) return;

        answerPendingCalls((call) =>
            JSON.stringify({
                ok: false,
                tool: call.name,
                error: {
                    kind: "rejected",
                    message: "המשתמש לא אישר את הפעולה",
                },
                retryable: false,
                next: [
                    "אל תנסה להריץ את הפעולה שוב.",
                    "שאל את המשתמש מה הוא כן רוצה שיקרה.",
                ],
            }),
        );

        settleApproval(pendingApproval.toolCallId, AiApprovalState.Rejected);
        void run();
    }, [pendingApproval, busy, run, answerPendingCalls, settleApproval]);

    /**
     * Answers an `ask_user` question. The server never ran that tool — it
     * streamed the question and stopped — so the answer is authored here and
     * the turn resumes with it in place.
     */
    const answerChoice = React.useCallback(
        (value: string) => {
            if (!pendingChoice || busy) return;

            answerPendingCalls((call) =>
                clientToolEnvelope(call.name, {
                    summary: `המשתמש בחר: ${value}`,
                    data: { answer: value },
                    next: [
                        "המשך לפי הבחירה הזו בלי לשאול שוב על אותו דבר.",
                    ],
                }),
            );

            setTimeline((items) =>
                items.map((item) =>
                    item.kind === AiTimelineKind.Choice &&
                    item.toolCallId === pendingChoice.toolCallId
                        ? { ...item, answer: value }
                        : item,
                ),
            );
            void run();
        },
        [pendingChoice, busy, run, answerPendingCalls],
    );

    const stop = React.useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = React.useCallback(() => {
        abortRef.current?.abort();
        transcript.current = [];
        setTimeline([]);
        setStats({ turns: 0 });
    }, []);

    // A turn left in flight when the panel unmounts would keep streaming into
    // dead state, and keep the upstream request billing.
    React.useEffect(() => () => abortRef.current?.abort(), []);

    return {
        timeline,
        busy,
        stats,
        pendingApproval,
        pendingChoice,
        send,
        approve,
        reject,
        answerChoice,
        stop,
        reset,
    };
}
