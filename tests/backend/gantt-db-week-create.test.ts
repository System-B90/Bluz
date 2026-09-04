import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        transaction: vi.fn(),
        query: {},
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

import { postgresDb } from "@/api-server/gantt";
import { DbWeek } from "@/api-server/gantt/db-week";
import {
    ganttCurriculum2WeeksSchema,
    ganttWeek2DaysSchema,
} from "@/api-server/gantt/schema";
import { ganttDaysSchema } from "@/api-server/gantt/schema/days";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { ganttWeeksSchema } from "@/api-server/gantt/schema/weeks";
import { CreateGanttWeekPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttDayIndex } from "@/api-shared/types/gantt/models";
import { MEAL_BREAKS_SYLLABUS_TITLE } from "@/api-shared/types/settings/meal";

type Row = Record<string, unknown>;

/** Everything one fake transaction recorded, keyed by target table. */
type TxLog = {
    inserts: Array<{ table: unknown; values: Row }>;
    executed: number;
};

/**
 * Minimal Drizzle transaction stand-in: records inserts, echoes the inserted
 * row back from `.returning()`, and answers the MAX(number) probe with
 * `highestWeekNumber`.
 */
function fakeTx(options: {
    highestWeekNumber?: null | number;
    mealSyllabusLinks?: Array<unknown>;
    existingMealMapping?: unknown;
    /** Drives the holiday auto-comment (#646); null ⇒ no date to derive from. */
    curriculumStartDate?: null | string;
}) {
    const log: TxLog = { inserts: [], executed: 0 };
    const tx = {
        execute: vi.fn(async () => {
            log.executed++;
        }),
        insert: (table: unknown) => ({
            values: (values: Row) => {
                log.inserts.push({ table, values });
                const result = [ values ];
                return Object.assign(Promise.resolve(result), {
                    returning: async () => result,
                });
            },
        }),
        // Two selects run here: the MAX(number) probe joins through the
        // curriculum→weeks junction, while the holiday lookup reads the
        // curriculum's start date straight off `c`. They are told apart by
        // whether the chain goes through `innerJoin`.
        select: () => ({
            from: () => ({
                innerJoin: () => ({
                    where: async () => [
                        { highest: options.highestWeekNumber ?? null },
                    ],
                }),
                where: async () => [
                    { startDate: options.curriculumStartDate ?? null },
                ],
            }),
        }),
        query: {
            ganttCurriculum2SyllabusesSchema: {
                findMany: async () => options.mealSyllabusLinks ?? [],
            },
            ganttCurriculumEventDayMappingsSchema: {
                findFirst: async () => options.existingMealMapping ?? undefined,
            },
        },
    };
    return { log, tx };
}

function runInTx(options: Parameters<typeof fakeTx>[0] = {}) {
    const { log, tx } = fakeTx(options);
    vi.mocked(postgresDb.transaction).mockImplementation(
        (async (cb: (t: unknown) => unknown) => await cb(tx)) as never,
    );
    return { log, tx };
}

function insertsInto(log: TxLog, table: unknown) {
    return log.inserts.filter((i) => i.table === table).map((i) => i.values);
}

const BASE: CreateGanttWeekPayload = {
    curriculumId: "c1",
    number: 1,
    comment: "",
    weekendDuty: false,
} as unknown as CreateGanttWeekPayload;

/** A meal syllabus wired to one module holding two events. */
function mealLinks() {
    return [
        {
            syllabus: {
                title: MEAL_BREAKS_SYLLABUS_TITLE,
                s2m: [
                    {
                        moduleId: "m_meal",
                        module: {
                            m2e: [ { eventId: "e_lunch" }, { eventId: "e_dinner" } ],
                        },
                    },
                ],
            },
        },
    ];
}

describe("DbWeek.createNewItem", () => {
    beforeEach(() => {
        vi.mocked(postgresDb.transaction).mockReset();
    });

    it("creates all seven days, sorted, with the default working minutes", async () => {
        const { log } = runInTx();

        const week = await DbWeek.createNewItem(BASE);

        const days = insertsInto(log, ganttDaysSchema);
        expect(days.map((d) => d.dayIndex)).toEqual([ 0, 1, 2, 3, 4, 5, 6 ]);
        expect(
            days.find((d) => d.dayIndex === GanttDayIndex.Saturday)!
                .totalWorkingMinutes,
        ).toBe(0);
        expect(week.w2d).toHaveLength(7);
        expect(week.w2d.map((l) => l.day.dayIndex)).toEqual([
            0, 1, 2, 3, 4, 5, 6,
        ]);
    });

    it("links every day to the new week, and the week to its curriculum", async () => {
        const { log } = runInTx();

        await DbWeek.createNewItem(BASE);

        const weekRow = insertsInto(log, ganttWeeksSchema)[ 0 ];
        expect(insertsInto(log, ganttWeek2DaysSchema)).toHaveLength(7);
        expect(
            insertsInto(log, ganttWeek2DaysSchema).every(
                (l) => l.weekId === weekRow.id,
            ),
        ).toBe(true);
        expect(insertsInto(log, ganttCurriculum2WeeksSchema)).toEqual([
            { curriculumId: "c1", weekId: weekRow.id },
        ]);
    });

    it("derives the next week number when the caller omits one (#434)", async () => {
        const { log } = runInTx({ highestWeekNumber: 4 });

        await DbWeek.createNewItem({
            ...BASE,
            number: undefined,
        } as unknown as CreateGanttWeekPayload);

        expect(insertsInto(log, ganttWeeksSchema)[ 0 ].number).toBe(5);
    });

    it("starts numbering at 1 for the first week of a curriculum", async () => {
        const { log } = runInTx({ highestWeekNumber: null });

        await DbWeek.createNewItem({
            ...BASE,
            number: undefined,
        } as unknown as CreateGanttWeekPayload);

        expect(insertsInto(log, ganttWeeksSchema)[ 0 ].number).toBe(1);
    });

    it("takes the curriculum row lock before reading the highest number", async () => {
        const { log } = runInTx({ highestWeekNumber: 2 });

        await DbWeek.createNewItem({
            ...BASE,
            number: undefined,
        } as unknown as CreateGanttWeekPayload);

        expect(log.executed).toBe(1);
    });

    it("skips the lock and the junction row for a parentless week", async () => {
        const { log } = runInTx();

        await DbWeek.createNewItem({
            number: undefined,
            comment: "",
            weekendDuty: false,
        } as unknown as CreateGanttWeekPayload);

        expect(log.executed).toBe(0);
        expect(insertsInto(log, ganttCurriculum2WeeksSchema)).toHaveLength(0);
        expect(insertsInto(log, ganttWeeksSchema)[ 0 ].number).toBe(1);
    });

    it("stamps each day with the Jewish holiday it falls on (#646)", async () => {
        // Week 1 starting Sunday 2026-09-06 covers erev Rosh Hashana (Friday
        // the 11th) and Rosh Hashana itself (Shabbat the 12th).
        const { log } = runInTx({ curriculumStartDate: "2026-09-06" });

        await DbWeek.createNewItem(BASE);

        const days = insertsInto(log, ganttDaysSchema);
        expect(days[ GanttDayIndex.Friday ].comment).toBe("ערב ראש השנה");
        expect(days[ GanttDayIndex.Saturday ].comment).toBe("ראש השנה 5787");
        // An ordinary day carries no comment at all, rather than an empty one.
        expect(days[ GanttDayIndex.Sunday ]).not.toHaveProperty("comment");
    });

    it("offsets the holiday lookup by the week's own number", async () => {
        // The same start date, but this is week 2 — a week later, so the
        // holidays above have passed and the fast of Gedaliah lands instead.
        const { log } = runInTx({ curriculumStartDate: "2026-09-06" });

        await DbWeek.createNewItem({ ...BASE, number: 2 });

        const days = insertsInto(log, ganttDaysSchema);
        expect(days.some((day) => day.comment === "ערב ראש השנה")).toBe(false);
        expect(days[ GanttDayIndex.Monday ].comment).toBe("צום גדליה");
    });

    it("stamps nothing when the curriculum has no start date to derive from", async () => {
        const { log } = runInTx({ curriculumStartDate: null });

        await DbWeek.createNewItem(BASE);

        expect(
            insertsInto(log, ganttDaysSchema).every(
                (day) => !("comment" in day),
            ),
        ).toBe(true);
    });

    it("anchors the seeded meal events onto the new week's Sunday", async () => {
        const { log } = runInTx({ mealSyllabusLinks: mealLinks() });

        await DbWeek.createNewItem(BASE);

        const sunday = insertsInto(log, ganttDaysSchema).find(
            (d) => d.dayIndex === GanttDayIndex.Sunday,
        )!;
        const mappings = insertsInto(
            log,
            ganttCurriculumEventDayMappingsSchema,
        );
        expect(mappings).toHaveLength(2);
        expect(mappings.map((m) => m.eventId)).toEqual([
            "e_lunch",
            "e_dinner",
        ]);
        expect(mappings.every((m) => m.dayId === sunday.id)).toBe(true);
        expect(mappings.every((m) => m.moduleId === "m_meal")).toBe(true);
    });

    it("does not re-anchor meals once a mapping already exists", async () => {
        const { log } = runInTx({
            mealSyllabusLinks: mealLinks(),
            existingMealMapping: { id: "map1" },
        });

        await DbWeek.createNewItem(BASE);

        expect(
            insertsInto(log, ganttCurriculumEventDayMappingsSchema),
        ).toHaveLength(0);
    });

    it("creates no mappings when the curriculum has no meal syllabus", async () => {
        const { log } = runInTx({
            mealSyllabusLinks: [ { syllabus: { title: "אחר", s2m: [] } } ],
        });

        await DbWeek.createNewItem(BASE);

        expect(
            insertsInto(log, ganttCurriculumEventDayMappingsSchema),
        ).toHaveLength(0);
    });
});
