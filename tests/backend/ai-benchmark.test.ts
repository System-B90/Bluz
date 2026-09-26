import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the assistant self-test (#704).
 *
 * The properties that matter here are not "does the model pass" — that depends
 * on the model — but that the harness itself is honest: it must be incapable
 * of touching real data, it must fail a case rather than the whole report when
 * the upstream dies, and its checks must actually discriminate between a model
 * that used the tools and one that made an answer up.
 */

// The fixture tools are self-contained, but the module graph still reaches the
// real registry (and through it the Mongo/Drizzle stack) via the agent.
vi.mock("@/api-server/ai/tools/calendar", () => ({ CALENDAR_TOOLS: [] }));
vi.mock("@/api-server/ai/tools/gantt", () => ({ GANTT_TOOLS: [] }));
vi.mock("@/api-server/ai/tools/calendar-entities", () => ({ CALENDAR_ENTITY_TOOLS: [] }));
vi.mock("@/api-server/ai/tools/gantt-authoring", () => ({ GANTT_AUTHORING_TOOLS: [] }));
vi.mock("@/api-server/ai/tools/hive", () => ({ HIVE_TOOLS: [] }));

import {
    AI_BENCHMARK_CASES,
    AiBenchmarkObservation,
} from "@/api-server/ai/benchmark/cases";
import {
    benchmarkTools,
    FIXTURE_DAY,
    FIXTURE_EVENTS,
    FIXTURE_FAKE_IDS,
    FIXTURE_TOOLS,
    filterFixtureEvents,
    isoAt,
} from "@/api-server/ai/benchmark/fixture";
import { benchmarkContext, runAiBenchmark } from "@/api-server/ai/benchmark/run";
import {
    AiChatRequest,
    AiProvider,
    AiProviderEvent,
} from "@/api-server/ai/provider";
import { AI_SUGGESTED_PROMPTS, AiToolCall, AiToolKind } from "@/api-shared/types/ai";
import { AiBenchmarkCaseState, AiBenchmarkLiveCase } from "@/api-shared/types/ai-benchmark";

type Scripted = { text?: string; toolCalls?: Array<AiToolCall> };

/**
 * A provider that answers every case with the same scripted turns. Cases run
 * sequentially, so `turnsPerCase` is replayed from the start for each one.
 */
function scriptedProvider(turnsPerCase: Array<Scripted>): AiProvider {
    let index = 0;
    return {
        name: "fake",
        defaultModel: "fake-model",
        chat: vi.fn(),
        async *streamChat(
            _request: AiChatRequest,
        ): AsyncIterable<AiProviderEvent> {
            const turn = turnsPerCase[index++ % turnsPerCase.length] ?? {};
            if (turn.text) yield { kind: "text", text: turn.text };
            yield {
                kind: "final",
                result: {
                    content: turn.text ?? "",
                    toolCalls: turn.toolCalls,
                    model: "fake-model",
                    usage: {
                        promptTokens: 1,
                        completionTokens: 1,
                        totalTokens: 2,
                    },
                },
            };
        },
    };
}

const actor = { id: "u1", displayName: "מיכאל" };

beforeEach(() => {
    vi.clearAllMocks();
});

describe("ai self-test fixture", () => {
    it("offers write tools that can never actually write", () => {
        // The suite measures restraint, so the model has to be *offered* a
        // destructive option — and that option has to be incapable of doing
        // anything if the gate ever fails.
        const writes = FIXTURE_TOOLS.filter(
            (tool) => tool.kind === AiToolKind.Write,
        );
        expect(writes.length).toBeGreaterThan(0);
        for (const tool of writes) {
            expect(() => tool.execute({}, {} as never)).toThrow();
        }
    });

    it("gives every fixture tool a friendly title", () => {
        for (const tool of FIXTURE_TOOLS) {
            expect(tool.title).toBeTruthy();
            expect(tool.title).not.toBe(tool.name);
        }
    });
});

describe("runAiBenchmark", () => {
    it("refuses any access to real data from inside a run", async () => {
        // The one property that would make this feature unsafe to ship: a
        // tool reaching a live controller during a self-test. The context
        // hands out a thrower instead of a connection, so a tool that ever
        // asked would fail loudly rather than quietly read the user's data.
        const context = benchmarkContext(actor);
        expect(() => context.readController()).toThrow(
            "בדיקת הסוכן אינה ניגשת לנתונים אמיתיים",
        );
        expect(() => context.writeController()).toThrow(
            "בדיקת הסוכן אינה ניגשת לנתונים אמיתיים",
        );
    });

    it("fails a model that answers without calling any tool", async () => {
        const result = await runAiBenchmark({
            provider: scriptedProvider([
                { text: "יש שלושה אירועים, בערך, נדמה לי." },
            ]),
            actor,
        });

        expect(result.total).toBeGreaterThan(0);
        // It cannot have called the read tools, so every "used the right tool"
        // check must be red — a suite that passed this would be worthless.
        const readCheck = result.cases[0].checks[0];
        expect(readCheck.passed).toBe(false);
        expect(readCheck.detail).toBeTruthy();
        expect(result.passed).toBeLessThan(result.total);
    });

    it("credits a model that reads the fixture and reports what it found", async () => {
        const result = await runAiBenchmark({
            provider: scriptedProvider([
                {
                    toolCalls: [
                        {
                            id: "c1",
                            name: "list_events",
                            arguments: JSON.stringify({
                                from: isoAt(0, 0),
                                to: isoAt(6, 0),
                            }),
                        },
                    ],
                },
                { text: "השבוע: מתמטיקה בדידה, אלגוריתמים, סדנת רשתות ומבני נתונים." },
            ]),
            actor,
        });

        const scheduleCase = result.cases.find(
            (entry) => entry.id === "suggested-week",
        );
        expect(scheduleCase?.toolCalls).toContain("list_events");
        expect(scheduleCase?.passed).toBe(true);
    });

    it("passes no case for a model that does nothing", async () => {
        // Every check must demand evidence of work; "proposed nothing bad"
        // alone used to hand an idle model most of the score.
        const result = await runAiBenchmark({
            provider: scriptedProvider([{ text: "בסדר." }]),
            actor,
        });
        expect(result.passed).toBe(0);
        expect(result.checksPassed).toBe(0);
        expect(result.gateHeld).toBe(true);
    });

    it("streams per-case progress while it runs", async () => {
        const snapshots: Array<Array<AiBenchmarkLiveCase>> = [];
        await runAiBenchmark({
            provider: scriptedProvider([{ text: "תשובה" }]),
            actor,
            onProgress: (cases) => snapshots.push(cases),
        });
        expect(snapshots[0].every((entry) => entry.state === AiBenchmarkCaseState.Pending)).toBe(true);
        expect(snapshots.some((cases) => cases[0].state === AiBenchmarkCaseState.Running)).toBe(true);
        expect(snapshots.at(-1)!.every((entry) => entry.state === AiBenchmarkCaseState.Done)).toBe(true);
    });

    it("covers every suggested chat prompt verbatim", () => {
        const prompts = AI_BENCHMARK_CASES.map((spec) => spec.prompt);
        for (const suggestion of AI_SUGGESTED_PROMPTS) {
            expect(prompts).toContain(suggestion);
        }
    });

    it("never approves a write, so a destructive request only ever gets proposed", async () => {
        const result = await runAiBenchmark({
            provider: scriptedProvider([
                {
                    toolCalls: [
                        {
                            id: "w1",
                            name: "delete_event",
                            arguments: JSON.stringify({ id: "fx-1" }),
                        },
                    ],
                },
            ]),
            actor,
        });

        const destructive = result.cases.find(
            (entry) => entry.id === "destructive-restraint",
        );
        expect(destructive?.toolCalls).toContain("delete_event");
        // Proposed, never executed — so the gate held.
        expect(destructive?.gateHeld).toBe(true);
        expect(result.gateHeld).toBe(true);
    });

    it("reports an upstream failure per case instead of losing the whole run", async () => {
        const provider: AiProvider = {
            name: "fake",
            defaultModel: "fake-model",
            chat: vi.fn(),
            // eslint-disable-next-line require-yield
            async *streamChat(): AsyncIterable<AiProviderEvent> {
                throw new Error("הגייטוויי לא זמין");
            },
        };

        const result = await runAiBenchmark({ provider, actor });

        expect(result.cases).toHaveLength(AI_BENCHMARK_CASES.length);
        expect(result.passed).toBe(0);
        for (const entry of result.cases) {
            expect(entry.error).toBe("הגייטוויי לא זמין");
            // One explanation, not four misleading behavioural failures.
            expect(
                entry.checks.every(
                    (check) =>
                        !check.passed &&
                        check.detail === "המקרה לא הושלם בגלל תקלה בשירות המודל.",
                ),
            ).toBe(true);
        }
    });

    it("totals the tokens a run spent so the cost is visible", async () => {
        const result = await runAiBenchmark({
            provider: scriptedProvider([{ text: "תשובה" }]),
            actor,
        });

        expect(result.model).toBe("fake-model");
        expect(result.totalTokens).toBe(2 * AI_BENCHMARK_CASES.length);
    });
});

describe("fake-event benchmark cases (#719)", () => {
    const base: AiBenchmarkObservation = {
        toolCalls: [],
        proposedWrites: [],
        executedWrites: [],
        askedUser: false,
        answer: "",
        reads: [],
        proposals: [],
    };
    const grade = (id: string, observation: AiBenchmarkObservation) =>
        AI_BENCHMARK_CASES.find((spec) => spec.id === id)!.checks.map((check) =>
            check.run(observation),
        );
    const byId = (id: string) =>
        FIXTURE_EVENTS.find((event) => event.id === id)!;
    const cover = (id: string, extra: Record<string, unknown> = {}) => ({
        name: "create_event",
        args: {
            name: "הרצאה",
            type: "הרצאה",
            startTime: byId(id).startTime,
            endTime: byId(id).endTime,
            courses: byId(id).courses,
            fake: true,
            ...extra,
        },
    });
    const tuesdayRead = (extra: Record<string, unknown> = {}) => ({
        name: "list_events",
        args: {
            from: isoAt(FIXTURE_DAY.TUESDAY, 0),
            to: isoAt(FIXTURE_DAY.WEDNESDAY, 0),
            ...extra,
        },
    });
    const fill = (days: Array<number>) =>
        days.map((day) => ({
            name: "create_event",
            args: {
                name: "הרצאה",
                startTime: isoAt(day, 9),
                endTime: isoAt(day, 12),
                fake: true,
            },
        }));

    it("filters fixture events by day and visibility like production", () => {
        const ids = filterFixtureEvents({
            from: isoAt(FIXTURE_DAY.TUESDAY, 0),
            to: isoAt(FIXTURE_DAY.WEDNESDAY, 0),
            hidden: true,
        }).map((event) => event.id);
        expect(ids).toEqual(["fx-h1", "fx-h2", "fx-h3"]);
    });

    it("mirrors the full production surface without touching real data", async () => {
        const production = [
            { ...FIXTURE_TOOLS[0], name: "list_courses", execute: vi.fn() },
            {
                ...FIXTURE_TOOLS.find((tool) => tool.kind === AiToolKind.Write)!,
                name: "delete_course",
                execute: vi.fn(),
            },
            { ...FIXTURE_TOOLS.find((tool) => tool.name === "list_events")!, execute: vi.fn() },
        ];
        const tools = benchmarkTools(production);
        const byName = (name: string) => tools.find((tool) => tool.name === name)!;

        expect(() => byName("delete_course").execute({}, {} as never)).toThrow();
        await expect(byName("list_courses").execute({}, {} as never)).resolves.toMatchObject({
            data: { total: 0 },
        });
        // A modelled tool answers from the fixture, not the production execute.
        await byName("list_events").execute({ from: isoAt(0, 0), to: isoAt(1, 0) }, {} as never);
        for (const tool of production) expect(tool.execute).not.toHaveBeenCalled();
        // Fixture-only tools still ride along.
        expect(tools.map((tool) => tool.name)).toContain("list_people");
    });

    it("credits a mixed split that spans the hidden window", () => {
        const at = (h: number, m = 0) => isoAt(FIXTURE_DAY.TUESDAY, h, m);
        const event = (from: string, to: string, type: string) => ({
            name: "create_event",
            args: { name: "x", type, startTime: from, endTime: to, fake: true },
        });
        expect(
            grade("fake-match-hidden", {
                ...base,
                reads: [tuesdayRead({ hidden: true })],
                proposals: [
                    event(at(9), at(10, 30), "סדנה"),
                    event(at(10, 30), at(12, 30), "הרצאה"),
                ],
            }),
        ).not.toContain(false);
        // Ends early: the window is not covered.
        expect(
            grade("fake-match-hidden", {
                ...base,
                reads: [tuesdayRead({ hidden: true })],
                proposals: [event(at(9), at(12), "הרצאה")],
            }),
        ).toContain(false);
    });

    it("passes a correct 'match the hidden events on Tuesday' run", () => {
        expect(
            grade("fake-match-hidden", {
                ...base,
                reads: [tuesdayRead({ hidden: true })],
                proposals: [cover("fx-h1"), cover("fx-h2")],
            }),
        ).not.toContain(false);
    });

    it("fails a run that covers the blocked slot or invents an instructor", () => {
        const results = grade("fake-match-hidden", {
            ...base,
            reads: [tuesdayRead()],
            proposals: [
                cover("fx-h1", { instructors: [1] }),
                cover("fx-h2"),
                cover("fx-h3"),
            ],
        });
        expect(results.filter((passed) => !passed).length).toBeGreaterThanOrEqual(3);
    });

    it("passes a five-day 09:00–12:00 fill of next week, fails one on Friday", () => {
        expect(
            grade("fake-fill-range", { ...base, proposals: fill([7, 8, 9, 10, 11]) }),
        ).not.toContain(false);
        expect(
            grade("fake-fill-range", { ...base, proposals: fill([7, 8, 9, 10, 12]) }),
        ).toContain(false);
    });

    it("credits asking on an ambiguous range", () => {
        expect(
            grade("fake-ambiguous-range", { ...base, askedUser: true }),
        ).not.toContain(false);
    });

    it("credits an undo that touches only the fakes", () => {
        const deletes = (ids: Array<string>) =>
            ids.map((id) => ({ name: "delete_event", args: { id } }));
        const reads = [{ name: "list_events", args: { fake: true } }];
        expect(
            grade("fake-undo", { ...base, reads, proposals: deletes(FIXTURE_FAKE_IDS) }),
        ).not.toContain(false);
        expect(
            grade("fake-undo", {
                ...base,
                reads,
                proposals: deletes([...FIXTURE_FAKE_IDS, "fx-1"]),
            }),
        ).toContain(false);
    });
});
