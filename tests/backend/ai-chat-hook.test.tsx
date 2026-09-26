// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Conversation state for the assistant panel.
 *
 * Every test renders inside `React.StrictMode`, which double-invokes state
 * updaters and keeps the *second* result. That is not incidental: the App
 * Router enables Strict Mode in development, and an updater that mutates a
 * flag it closed over silently loses its first delta there while passing a
 * naive test.
 */

const { streamAiChat } = vi.hoisted(() => ({ streamAiChat: vi.fn() }));

vi.mock("@/api-client/ai", () => ({ streamAiChat, fetchAiTools: vi.fn() }));

import {
    AiApprovalState,
    AiTimelineItem,
    AiTimelineKind,
    AiToolState,
    useAiChat,
} from "@/components/ai/use-ai-chat";
import {
    AiRole,
    AiStreamEventType,
    AiToolDanger,
} from "@/api-shared/types/ai";

/** The error text the panel is currently showing, if any. */
const failureText = (timeline: Array<AiTimelineItem>) =>
    timeline
        .filter((item) => item.kind === AiTimelineKind.Failure)
        .map((item) => (item as { message: string }).message)
        .at(-1);

/** Replays a scripted event stream, one turn per call. */
function scriptTurns(turns: Array<Array<unknown>>) {
    let index = 0;
    streamAiChat.mockImplementation(async function* () {
        for (const event of turns[index++] ?? []) yield event;
    });
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <React.StrictMode>{children}</React.StrictMode>
);

const renderChat = () => renderHook(() => useAiChat({}), { wrapper });

const doneEvent = (messages: Array<unknown> = [], awaitingApproval = false) => ({
    type: AiStreamEventType.Done,
    messages,
    awaitingApproval,
    model: "m",
});

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

describe("useAiChat", () => {
    it("renders every delta of a streamed answer under Strict Mode", async () => {
        // The regression this pins: a flag mutated inside the updater loses the
        // first delta, and every later one then finds no bubble to append to,
        // so the answer never appears at all.
        scriptTurns([
            [
                { type: AiStreamEventType.Delta, text: "של" },
                { type: AiStreamEventType.Delta, text: "ום" },
                doneEvent(),
            ],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("היי"));

        await waitFor(() => expect(result.current.busy).toBe(false));
        const assistant = result.current.timeline.filter(
            (item) => item.kind === AiTimelineKind.Assistant,
        );
        expect(assistant).toHaveLength(1);
        expect(assistant[0]).toMatchObject({ text: "שלום" });
    });

    it("shows the user's own message immediately", async () => {
        scriptTurns([[doneEvent()]]);
        const { result } = renderChat();
        await act(async () => result.current.send("מה יש היום?"));

        expect(result.current.timeline[0]).toMatchObject({
            kind: AiTimelineKind.User,
            text: "מה יש היום?",
        });
    });

    it("ignores an empty message", async () => {
        const { result } = renderChat();
        await act(async () => result.current.send("   "));

        expect(streamAiChat).not.toHaveBeenCalled();
        expect(result.current.timeline).toHaveLength(0);
    });

    it("replays the transcript the server returned on the next turn", async () => {
        scriptTurns([
            [doneEvent([{ role: AiRole.Assistant, content: "ראשון" }])],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("א"));
        await waitFor(() => expect(result.current.busy).toBe(false));
        await act(async () => result.current.send("ב"));

        const sent = streamAiChat.mock.calls[1][0].messages;
        expect(sent.map((m: { role: string }) => m.role)).toEqual([
            AiRole.User,
            AiRole.Assistant,
            AiRole.User,
        ]);
    });

    it("surfaces a write proposal and runs nothing until approved", async () => {
        scriptTurns([
            [
                {
                    type: AiStreamEventType.ToolProposal,
                    toolCallId: "w1",
                    name: "delete_event",
                    arguments: { id: "e1" },
                    summary: "מחיקת אירוע e1",
                },
                doneEvent(
                    [
                        {
                            role: AiRole.Assistant,
                            content: "",
                            toolCalls: [
                                {
                                    id: "w1",
                                    name: "delete_event",
                                    arguments: "{}",
                                },
                            ],
                        },
                    ],
                    true,
                ),
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("תמחק"));
        await waitFor(() =>
            expect(result.current.pendingApproval).toMatchObject({
                calls: [{ toolCallId: "w1", summary: "מחיקת אירוע e1" }],
            }),
        );
        expect(streamAiChat).toHaveBeenCalledTimes(1);

        await act(async () => result.current.approve());
        // Approval carries exactly the one id the user saw.
        expect(streamAiChat.mock.calls[1][0].approvedToolCallIds).toEqual(["w1"]);
    });

    it("groups a turn's proposals into one card approved as a unit", async () => {
        const proposal = (id: string) => ({
            type: AiStreamEventType.ToolProposal,
            toolCallId: id,
            name: "create_event",
            arguments: { name: "הרצאה", fake: true },
            summary: `יצירת ${id}`,
        });
        scriptTurns([
            [
                proposal("c1"),
                proposal("c2"),
                proposal("c3"),
                doneEvent(
                    [
                        {
                            role: AiRole.Assistant,
                            content: "",
                            toolCalls: ["c1", "c2", "c3"].map((id) => ({
                                id,
                                name: "create_event",
                                arguments: "{}",
                            })),
                        },
                    ],
                    true,
                ),
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("תמלא"));
        await waitFor(() =>
            expect(result.current.pendingApproval?.calls).toHaveLength(3),
        );
        expect(
            result.current.timeline.filter((item) => item.kind === "approval"),
        ).toHaveLength(1);

        await act(async () => result.current.approve());
        expect(streamAiChat.mock.calls[1][0].approvedToolCallIds).toEqual([
            "c1",
            "c2",
            "c3",
        ]);
    });

    it("ignores a second approve click fired before the first POST resolves", async () => {
        // Regression for the double-fire bug: two rapid approve clicks must
        // not both reach streamAiChat, or a non-idempotent write tool (e.g.
        // create_event) runs twice with the same approvedToolCallIds.
        let releaseFirstTurn: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            releaseFirstTurn = resolve;
        });
        streamAiChat.mockImplementation(async function* () {
            yield {
                type: AiStreamEventType.ToolProposal,
                toolCallId: "w1",
                name: "delete_event",
                arguments: { id: "e1" },
                summary: "מחיקת אירוע e1",
            };
            yield doneEvent(
                [
                    {
                        role: AiRole.Assistant,
                        content: "",
                        toolCalls: [
                            { id: "w1", name: "delete_event", arguments: "{}" },
                        ],
                    },
                ],
                true,
            );
        });

        const { result } = renderChat();
        await act(async () => result.current.send("תמחק"));
        await waitFor(() => expect(result.current.pendingApproval).toBeTruthy());

        streamAiChat.mockImplementation(async function* () {
            await gate;
            yield doneEvent();
        });

        // Two rapid clicks: only the first should start a request.
        act(() => {
            result.current.approve();
            result.current.approve();
        });
        expect(streamAiChat).toHaveBeenCalledTimes(2);

        releaseFirstTurn?.();
        await waitFor(() => expect(result.current.busy).toBe(false));
        // Still exactly one approval POST for the second turn.
        expect(streamAiChat).toHaveBeenCalledTimes(2);
    });

    it("answers the model's tool call when the user declines", async () => {
        // An unanswered tool call makes every later request malformed, so a
        // refusal has to be written into the transcript as its result.
        scriptTurns([
            [
                {
                    type: AiStreamEventType.ToolProposal,
                    toolCallId: "w1",
                    name: "delete_event",
                    arguments: { id: "e1" },
                    summary: "מחיקת אירוע e1",
                },
                doneEvent(
                    [
                        {
                            role: AiRole.Assistant,
                            content: "",
                            toolCalls: [
                                {
                                    id: "w1",
                                    name: "delete_event",
                                    arguments: "{}",
                                },
                            ],
                        },
                    ],
                    true,
                ),
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("תמחק"));
        await waitFor(() => expect(result.current.pendingApproval).toBeTruthy());
        await act(async () => result.current.reject());

        const sent = streamAiChat.mock.calls[1][0];
        expect(sent.approvedToolCallIds).toEqual([]);
        expect(sent.messages.at(-1)).toMatchObject({
            role: AiRole.Tool,
            toolCallId: "w1",
        });
        // The card stays in the timeline as a record of the decision, but it
        // is no longer pending, so nothing is awaiting the user.
        expect(result.current.pendingApproval).toBeUndefined();
        expect(
            result.current.timeline.find(
                (item) => item.kind === AiTimelineKind.Approval,
            ),
        ).toMatchObject({ state: AiApprovalState.Rejected });
    });

    it("marks a tool chip failed when the tool failed", async () => {
        scriptTurns([
            [
                {
                    type: AiStreamEventType.ToolStart,
                    toolCallId: "c1",
                    name: "list_events",
                },
                {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: "c1",
                    name: "list_events",
                    summary: "מונגו נפל",
                    ok: false,
                },
                doneEvent(),
            ],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("מה יש?"));
        await waitFor(() => expect(result.current.busy).toBe(false));

        const chips = result.current.timeline.filter(
            (item) => item.kind === AiTimelineKind.Tool,
        );
        // The chip is updated in place, not appended twice.
        expect(chips).toHaveLength(1);
        expect(chips[0]).toMatchObject({
            state: AiToolState.Failed,
            summary: "מונגו נפל",
        });
    });

    it("surfaces a terminal error frame", async () => {
        scriptTurns([
            [{ type: AiStreamEventType.Error, message: "שירות ה-AI נפל" }],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("היי"));
        await waitFor(() =>
            expect(failureText(result.current.timeline)).toBe("שירות ה-AI נפל"),
        );
    });

    it("keeps a mid-turn error's produced tool messages in the transcript", async () => {
        // Regression: the iteration-cap error carries whatever tool calls
        // already ran that turn. Dropping them would have the next request
        // replay — and re-run — those same writes.
        scriptTurns([
            [
                {
                    type: AiStreamEventType.Error,
                    message: "יותר מדי צעדים",
                    messages: [
                        {
                            role: AiRole.Assistant,
                            content: "",
                            toolCalls: [
                                { id: "c1", name: "list_events", arguments: "{}" },
                            ],
                        },
                        {
                            role: AiRole.Tool,
                            toolCallId: "c1",
                            name: "list_events",
                            content: "[]",
                        },
                    ],
                },
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("מה יש?"));
        await waitFor(() =>
            expect(failureText(result.current.timeline)).toBe("יותר מדי צעדים"),
        );

        await act(async () => result.current.send("נסה שוב"));
        const sent = streamAiChat.mock.calls[1][0].messages;
        expect(sent.map((m: { role: string }) => m.role)).toEqual([
            AiRole.User,
            AiRole.Assistant,
            AiRole.Tool,
            AiRole.User,
        ]);
    });

    it("orders prose, tools and more prose the way the turn happened", async () => {
        // The regression this pins: every delta of a turn collapsing into one
        // bubble, which strands the tool chips after text that was written
        // before the tool ran and makes a multi-step answer unauditable.
        scriptTurns([
            [
                { type: AiStreamEventType.Delta, text: "בודק" },
                {
                    type: AiStreamEventType.ToolStart,
                    toolCallId: "c1",
                    name: "list_events",
                    title: 'אירועי הלו"ז',
                },
                {
                    type: AiStreamEventType.ToolResult,
                    toolCallId: "c1",
                    name: "list_events",
                    title: 'אירועי הלו"ז',
                    summary: "נמצאו 3",
                    ok: true,
                    durationMs: 120,
                },
                { type: AiStreamEventType.Delta, text: "מצאתי 3" },
                doneEvent(),
            ],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("מה יש?"));
        await waitFor(() => expect(result.current.busy).toBe(false));

        expect(result.current.timeline.map((item) => item.kind)).toEqual([
            AiTimelineKind.User,
            AiTimelineKind.Assistant,
            AiTimelineKind.Tool,
            AiTimelineKind.Assistant,
        ]);
        const bubbles = result.current.timeline.filter(
            (item) => item.kind === AiTimelineKind.Assistant,
        );
        expect(bubbles.map((item) => (item as { text: string }).text)).toEqual([
            "בודק",
            "מצאתי 3",
        ]);
    });

    it("collects reasoning into its own block and never into the transcript", async () => {
        scriptTurns([
            [
                { type: AiStreamEventType.Reasoning, text: "קודם " },
                { type: AiStreamEventType.Reasoning, text: "אבדוק" },
                { type: AiStreamEventType.Delta, text: "תשובה" },
                doneEvent([{ role: AiRole.Assistant, content: "תשובה" }]),
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("היי"));
        await waitFor(() => expect(result.current.busy).toBe(false));

        const thinking = result.current.timeline.filter(
            (item) => item.kind === AiTimelineKind.Thinking,
        );
        expect(thinking).toHaveLength(1);
        expect(thinking[0]).toMatchObject({ text: "קודם אבדוק" });

        // Replaying reasoning would bill the model to re-read its own
        // scratchpad on every later turn.
        await act(async () => result.current.send("ועוד"));
        const sent = streamAiChat.mock.calls[1][0].messages;
        expect(JSON.stringify(sent)).not.toContain("אבדוק");
    });

    it("answers an ask_user question with the option the user picked", async () => {
        scriptTurns([
            [
                {
                    type: AiStreamEventType.Choice,
                    toolCallId: "q1",
                    question: "באיזה שיעור מדובר?",
                    options: [
                        { value: "fx-1", label: "יום שני" },
                        { value: "fx-2", label: "יום רביעי" },
                    ],
                    allowFreeText: true,
                },
                doneEvent(
                    [
                        {
                            role: AiRole.Assistant,
                            content: "",
                            toolCalls: [
                                { id: "q1", name: "ask_user", arguments: "{}" },
                            ],
                        },
                    ],
                    true,
                ),
            ],
            [doneEvent()],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("תזיז את השיעור"));
        await waitFor(() => expect(result.current.pendingChoice).toBeTruthy());

        await act(async () => result.current.answerChoice("fx-2"));

        // The server never ran `ask_user`, so the client owes the model that
        // call's result — without it every later request is malformed.
        const sent = streamAiChat.mock.calls[1][0].messages;
        const answer = sent.at(-1);
        expect(answer).toMatchObject({ role: AiRole.Tool, toolCallId: "q1" });
        expect(JSON.parse(answer.content)).toMatchObject({
            ok: true,
            data: { answer: "fx-2" },
        });
        expect(result.current.pendingChoice).toBeUndefined();
    });

    it("carries the danger level and impact of a proposed write", async () => {
        scriptTurns([
            [
                {
                    type: AiStreamEventType.ToolProposal,
                    toolCallId: "w1",
                    name: "delete_event",
                    title: "מחיקת אירוע",
                    danger: AiToolDanger.Destructive,
                    arguments: { id: "e1" },
                    summary: "מחיקת אירוע e1",
                    impact: ["האירוע יוסר מהלוח"],
                },
                doneEvent([], true),
            ],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("תמחק"));

        await waitFor(() =>
            expect(result.current.pendingApproval).toMatchObject({
                calls: [
                    {
                        danger: AiToolDanger.Destructive,
                        impact: ["האירוע יוסר מהלוח"],
                    },
                ],
                state: AiApprovalState.Pending,
            }),
        );
    });

    it("stops a running tool chip from spinning forever after an abort", async () => {
        streamAiChat.mockImplementation(async function* (
            _payload: unknown,
            signal: AbortSignal,
        ) {
            yield {
                type: AiStreamEventType.ToolStart,
                toolCallId: "c1",
                name: "list_events",
                title: 'אירועי הלו"ז',
            };
            // Ends only when the panel aborts, exactly as the real client's
            // fetch does when the user presses stop.
            await new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () =>
                    reject(new DOMException("aborted", "AbortError")),
                );
            });
        });

        const { result } = renderChat();
        await act(async () => result.current.send("מה יש?"));
        await waitFor(() =>
            expect(
                result.current.timeline.some(
                    (item) => item.kind === AiTimelineKind.Tool,
                ),
            ).toBe(true),
        );

        await act(async () => result.current.stop());
        await waitFor(() => expect(result.current.busy).toBe(false));

        const chip = result.current.timeline.find(
            (item) => item.kind === AiTimelineKind.Tool,
        );
        expect(chip).toMatchObject({ state: AiToolState.Failed });
    });

    it("clears everything on reset", async () => {
        scriptTurns([[doneEvent([{ role: AiRole.Assistant, content: "א" }])], [doneEvent()]]);

        const { result } = renderChat();
        await act(async () => result.current.send("היי"));
        await waitFor(() => expect(result.current.busy).toBe(false));
        await act(async () => result.current.reset());

        expect(result.current.timeline).toHaveLength(0);
        await act(async () => result.current.send("שוב"));
        // The cleared transcript must not resurrect the old turn.
        expect(streamAiChat.mock.calls[1][0].messages).toHaveLength(1);
    });
});
