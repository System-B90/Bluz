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
    AiTimelineKind,
    useAiChat,
} from "@/components/ai/use-ai-chat";
import { AiRole, AiStreamEventType } from "@/api-shared/types/ai";

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
                toolCallId: "w1",
                summary: "מחיקת אירוע e1",
            }),
        );
        expect(streamAiChat).toHaveBeenCalledTimes(1);

        await act(async () => result.current.approve());
        // Approval carries exactly the one id the user saw.
        expect(streamAiChat.mock.calls[1][0].approvedToolCallIds).toEqual(["w1"]);
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
        expect(result.current.pendingApproval).toBeNull();
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
        expect(chips[0]).toMatchObject({ state: "failed", summary: "מונגו נפל" });
    });

    it("surfaces a terminal error frame", async () => {
        scriptTurns([
            [{ type: AiStreamEventType.Error, message: "שירות ה-AI נפל" }],
        ]);

        const { result } = renderChat();
        await act(async () => result.current.send("היי"));
        await waitFor(() => expect(result.current.error).toBe("שירות ה-AI נפל"));
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
