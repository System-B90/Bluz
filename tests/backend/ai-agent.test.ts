import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the agent loop, centred on the property the whole design
 * exists to guarantee: a write tool never runs unless the human approved that
 * exact tool-call id.
 *
 * The tool registry is mocked so the tests describe loop behaviour rather than
 * the behaviour of any particular tool.
 */

// The registry snapshots its tool list at module init, so the fakes have to
// exist before the mocked modules are evaluated — hence `vi.hoisted`.
const { calendarTools, ganttTools, readExecute, writeExecute } = vi.hoisted(
    () => {
        const read = vi.fn(async () => ({
            data: { ok: true },
            summary: "נקרא",
        }));
        const write = vi.fn(async () => ({
            data: { ok: true },
            summary: "נכתב",
        }));
        return {
            readExecute: read,
            writeExecute: write,
            ganttTools: [] as Array<unknown>,
            calendarTools: [
                {
                    name: "read_thing",
                    description: "read",
                    kind: "read",
                    parameters: { type: "object", properties: {} },
                    execute: read,
                },
                {
                    name: "write_thing",
                    description: "write",
                    kind: "write",
                    parameters: { type: "object", properties: {} },
                    describe: () => "שינוי מסוכן",
                    execute: write,
                },
            ] as Array<unknown>,
        };
    },
);

// The real tool modules pull in the Mongo driver, the Drizzle stack and the
// gantt planner. None of that is under test here.
vi.mock("@/api-server/ai/tools/calendar", () => ({ CALENDAR_TOOLS: calendarTools }));
vi.mock("@/api-server/ai/tools/gantt", () => ({ GANTT_TOOLS: ganttTools }));

import { runAiAgent } from "@/api-server/ai/agent";
import {
    AiChatRequest,
    AiProvider,
    AiProviderEvent,
} from "@/api-server/ai/provider";
import { AiToolContext } from "@/api-server/ai/tools";
import {
    AI_MAX_RESPONSE_TOKENS,
    AiMessage,
    AiRole,
    AiStreamEvent,
    AiStreamEventType,
    AiToolCall,
} from "@/api-shared/types/ai";

type Turn = { text?: string; toolCalls?: Array<AiToolCall> };

/** A provider that replays scripted turns and records what it was asked. */
function fakeProvider(turns: Array<Turn>): AiProvider & {
    requests: Array<AiChatRequest>;
} {
    const requests: Array<AiChatRequest> = [];
    let index = 0;

    return {
        requests,
        name: "fake",
        defaultModel: "fake-model",
        chat: vi.fn(),
        async *streamChat(request: AiChatRequest): AsyncIterable<AiProviderEvent> {
            requests.push(request);
            const turn = turns[index++] ?? { text: "done" };
            if (turn.text) yield { kind: "text", text: turn.text };
            yield {
                kind: "final",
                result: {
                    content: turn.text ?? "",
                    toolCalls: turn.toolCalls,
                    model: "fake-model",
                    usage: {
                        promptTokens: 1,
                        completionTokens: 2,
                        totalTokens: 3,
                    },
                },
            };
        },
    };
}

const context: AiToolContext = {
    actor: { id: "u1", displayName: "מיכאל" },
    readController: vi.fn(),
    writeController: vi.fn(),
};

async function drain(
    events: AsyncGenerator<AiStreamEvent>,
): Promise<Array<AiStreamEvent>> {
    const collected: Array<AiStreamEvent> = [];
    for await (const event of events) collected.push(event);
    return collected;
}

const call = (id: string, name: string, args = "{}"): AiToolCall => ({
    id,
    name,
    arguments: args,
});

const userTurn = (text: string): Array<AiMessage> => [
    { role: AiRole.User, content: text },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("runAiAgent", () => {
    it("streams text and finishes when the model calls no tools", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([{ text: "שלום" }]),
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(events.map((event) => event.type)).toEqual([
            AiStreamEventType.Delta,
            AiStreamEventType.Done,
        ]);
        const done = events.at(-1);
        expect(done).toMatchObject({ awaitingApproval: false });
    });

    it("caps every model call with a max_tokens ceiling", async () => {
        // Without this an adversarial or runaway prompt has no bound on the
        // cost of a single response.
        const provider = fakeProvider([{ text: "שלום" }]);
        await drain(
            runAiAgent({
                provider,
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(provider.requests[0].maxTokens).toBe(AI_MAX_RESPONSE_TOKENS);
    });

    it("prepends a server-built system prompt the caller cannot supply", async () => {
        const provider = fakeProvider([{ text: "ok" }]);
        await drain(
            runAiAgent({
                provider,
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        const sent = provider.requests[0].messages;
        expect(sent[0].role).toBe(AiRole.System);
        expect(sent.filter((m) => m.role === AiRole.System)).toHaveLength(1);
    });

    it("runs a read tool unattended and feeds the result back", async () => {
        const provider = fakeProvider([
            { toolCalls: [call("c1", "read_thing")] },
            { text: "התשובה" },
        ]);
        const events = await drain(
            runAiAgent({
                provider,
                messages: userTurn("מה יש?"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(readExecute).toHaveBeenCalledOnce();
        expect(events.map((event) => event.type)).toContain(
            AiStreamEventType.ToolResult,
        );
        // Second call to the model carries the tool's answer.
        expect(provider.requests[1].messages.at(-1)).toMatchObject({
            role: AiRole.Tool,
            toolCallId: "c1",
        });
    });

    it("refuses to run a write tool without approval", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("w1", "write_thing")] },
                ]),
                messages: userTurn("תמחק"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(writeExecute).not.toHaveBeenCalled();
        expect(events.at(-2)).toMatchObject({
            type: AiStreamEventType.ToolProposal,
            toolCallId: "w1",
            summary: "שינוי מסוכן",
        });
        expect(events.at(-1)).toMatchObject({
            type: AiStreamEventType.Done,
            awaitingApproval: true,
        });
    });

    it("does not let an approval for one call authorise another", async () => {
        await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("w2", "write_thing")] },
                ]),
                messages: userTurn("תמחק"),
                context,
                // A stale id from an earlier proposal must not carry over.
                approvedToolCallIds: new Set(["w1"]),
            }),
        );

        expect(writeExecute).not.toHaveBeenCalled();
    });

    it("stops the whole turn at the first unapproved write", async () => {
        // A later call may depend on the skipped one's effect, so continuing
        // would have the model reason about a state that never existed.
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    {
                        toolCalls: [
                            call("w1", "write_thing"),
                            call("c2", "read_thing"),
                        ],
                    },
                ]),
                messages: userTurn("תעשה שניים"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(readExecute).not.toHaveBeenCalled();
        expect(events.at(-1)).toMatchObject({ awaitingApproval: true });
    });

    it("runs the pending write on resume without re-asking the model first", async () => {
        // The resumed transcript already ends in the assistant's tool call.
        // Calling the model again before answering it would replay a tool call
        // with no matching result, which every backend rejects.
        const provider = fakeProvider([{ text: "בוצע" }]);
        const events = await drain(
            runAiAgent({
                provider,
                messages: [
                    ...userTurn("תמחק"),
                    {
                        role: AiRole.Assistant,
                        content: "",
                        toolCalls: [call("w1", "write_thing")],
                    },
                ],
                context,
                approvedToolCallIds: new Set(["w1"]),
            }),
        );

        expect(writeExecute).toHaveBeenCalledOnce();
        expect(events.some((e) => e.type === AiStreamEventType.ToolStart)).toBe(
            true,
        );
        // The first model call of this turn already carries the tool result.
        expect(provider.requests[0].messages.at(-1)).toMatchObject({
            role: AiRole.Tool,
            toolCallId: "w1",
        });
    });

    it("treats an already-answered tool call as settled", async () => {
        const provider = fakeProvider([{ text: "ok" }]);
        await drain(
            runAiAgent({
                provider,
                messages: [
                    ...userTurn("תמחק"),
                    {
                        role: AiRole.Assistant,
                        content: "",
                        toolCalls: [call("w1", "write_thing")],
                    },
                    {
                        role: AiRole.Tool,
                        toolCallId: "w1",
                        name: "write_thing",
                        content: '{"error":"המשתמש לא אישר את הפעולה"}',
                    },
                ],
                context,
                approvedToolCallIds: new Set(["w1"]),
            }),
        );

        // A declined call must not be re-run just because its id is approved.
        expect(writeExecute).not.toHaveBeenCalled();
    });

    it("reports an unknown tool back to the model instead of throwing", async () => {
        const provider = fakeProvider([
            { toolCalls: [call("c1", "no_such_tool")] },
            { text: "סליחה" },
        ]);
        const events = await drain(
            runAiAgent({
                provider,
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(events).toContainEqual(
            expect.objectContaining({
                type: AiStreamEventType.ToolResult,
                ok: false,
            }),
        );
        expect(events.at(-1)?.type).toBe(AiStreamEventType.Done);
    });

    it("reports malformed tool arguments back to the model", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("c1", "read_thing", "{not json")] },
                    { text: "שוב" },
                ]),
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(readExecute).not.toHaveBeenCalled();
        expect(events).toContainEqual(
            expect.objectContaining({
                type: AiStreamEventType.ToolResult,
                ok: false,
            }),
        );
    });

    it("keeps going after a tool throws", async () => {
        readExecute.mockRejectedValueOnce(new Error("מונגו נפל"));
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("c1", "read_thing")] },
                    { text: "התאוששתי" },
                ]),
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(events).toContainEqual(
            expect.objectContaining({
                type: AiStreamEventType.ToolResult,
                ok: false,
                summary: "מונגו נפל",
            }),
        );
        expect(events.at(-1)?.type).toBe(AiStreamEventType.Done);
    });

    it("gives up rather than looping on tools forever", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider(
                    Array.from({ length: 20 }, () => ({
                        toolCalls: [call("c1", "read_thing")],
                    })),
                ),
                messages: userTurn("היי"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        expect(events.at(-1)?.type).toBe(AiStreamEventType.Error);
    });

    it("returns only this turn's messages for the client to replay", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("c1", "read_thing")] },
                    { text: "התשובה" },
                ]),
                messages: userTurn("מה יש?"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        const done = events.at(-1);
        expect(done?.type).toBe(AiStreamEventType.Done);
        const produced =
            done?.type === AiStreamEventType.Done ? done.messages : [];
        // The user's own message is already in the client's transcript;
        // echoing it back would duplicate it on the next turn.
        expect(produced.some((m) => m.role === AiRole.User)).toBe(false);
        expect(produced.map((m) => m.role)).toEqual([
            AiRole.Assistant,
            AiRole.Tool,
            AiRole.Assistant,
        ]);
    });

    it("accumulates usage across every model call in a turn", async () => {
        const events = await drain(
            runAiAgent({
                provider: fakeProvider([
                    { toolCalls: [call("c1", "read_thing")] },
                    { text: "התשובה" },
                ]),
                messages: userTurn("מה יש?"),
                context,
                approvedToolCallIds: new Set(),
            }),
        );

        const done = events.at(-1);
        expect(done).toMatchObject({
            usage: { promptTokens: 2, completionTokens: 4, totalTokens: 6 },
        });
    });
});
