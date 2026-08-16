import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { venueTime } from "./helpers/venue-time";
import { diffEventFields } from "@/api-shared/event-history";
import { CutPlanInput, planCut } from "@/api-shared/gantt/cut-planner";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { dayDomainReducer } from "@/components/gantt/state/reducers/day-reducer";
import { eventDomainReducer } from "@/components/gantt/state/reducers/event-reducer";
import { moduleDomainReducer } from "@/components/gantt/state/reducers/module-reducer";

/**
 * Regression tests for the behavioural fixes made for issues #424-#430. Each
 * case is written against the observable symptom the issue described, so a
 * revert shows up as a failing assertion rather than a silent change.
 */

describe("event history diffing (#430)", () => {
    it("treats a Dayjs and a Date for the same instant as unchanged", () => {
        const instant = new Date("2026-05-01T08:30:00.000Z");

        expect(
            diffEventFields(
                { startTime: instant },
                { startTime: dayjs(instant) },
            ),
        ).toEqual([]);
    });

    it("still reports a genuine time change across the two shapes", () => {
        const changes = diffEventFields(
            { startTime: new Date("2026-05-01T08:30:00.000Z") },
            { startTime: dayjs("2026-05-01T09:30:00.000Z") },
        );

        expect(changes).toHaveLength(1);
        expect(changes[0].field).toBe("startTime");
    });
});

describe("cut planner meal windows past midnight (#430)", () => {
    /** One week of days `d0`..`d6`, anchored on a Sunday. */
    function baseInput(overrides: Partial<CutPlanInput>): CutPlanInput {
        const days: CutPlanInput["days"] = {};
        const dayIds: Array<string> = [];
        for (let d = 0; d < 7; d++) {
            days[`d${d}`] = { id: `d${d}`, dayIndex: d as GanttDayIndex };
            dayIds.push(`d${d}`);
        }
        return {
            startDate: "2024-01-07",
            weeks: [{ id: "week0", dayIds }],
            days,
            events: [],
            mappings: [],
            recurrenceExceptions: [],
            dayStartTime: "08:00",
            ...overrides,
        };
    }

    it("does not drag a past-midnight event back to the morning meal window", () => {
        const breakfast = {
            id: "breakfast",
            title: MEAL_EVENT_TITLES.breakfastTime,
            recurrence: EventRecurrence.None,
            minimumDuration: 30,
            allocatedDuration: 30,
            splitAcrossBreaks: false,
        };
        // A long day that stacks past 24:00: once the cursor wraps, a
        // time-of-day comparison reads it as 00:xx and "overlaps" breakfast.
        const marathon = {
            id: "marathon",
            title: "marathon",
            recurrence: EventRecurrence.None,
            minimumDuration: 16 * 60,
            allocatedDuration: 16 * 60,
            splitAcrossBreaks: false,
        };
        // Long enough that a time-of-day comparison would see its (wrapped)
        // 00:00-08:00 span straddling the 07:00 breakfast window.
        const afterMidnight = {
            id: "after",
            title: "after",
            recurrence: EventRecurrence.None,
            minimumDuration: 8 * 60,
            allocatedDuration: 8 * 60,
            splitAcrossBreaks: false,
        };

        const plan = planCut(
            baseInput({
                events: [breakfast, marathon, afterMidnight],
                mappings: [
                    { eventId: "breakfast", dayId: "d0", sortOrder: 0 },
                    { eventId: "marathon", dayId: "d0", sortOrder: 1 },
                    { eventId: "after", dayId: "d0", sortOrder: 2 },
                ],
                dayStartTime: "08:00",
                breakfastTime: "07:00",
            }),
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "after");
        expect(occ).toBeDefined();
        // Stacks straight on after the marathon (08:00 + 16h), on the *next*
        // calendar day — never rewound to the morning after breakfast.
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-08T00:00"),
        );
    });
});

describe("gantt store normalization on entity removal (#428)", () => {
    function emptyStore(): NormalizedStore {
        return {
            curriculums: {},
            syllabuses: {},
            modules: {},
            events: {},
            weeks: {},
            days: {},
        };
    }

    function storeWithWeekAndDay(): NormalizedStore {
        const store = emptyStore();
        store.weeks["week1"] = {
            id: "week1",
            curriculumId: "cur1",
            title: "שבוע 1",
            number: 1,
            days: ["day1"],
            weekendDuty: false,
        } as NormalizedStore["weeks"][string];
        store.days["day1"] = {
            id: "day1",
            weekId: "week1",
            title: "ראשון",
            dayIndex: 0,
            totalWorkingMinutes: 480,
        } as NormalizedStore["days"][string];
        return store;
    }

    it("adds a new day to its week's day list", () => {
        const next = dayDomainReducer(storeWithWeekAndDay(), {
            type: "ADD_DAY",
            payload: {
                day: {
                    id: "day2",
                    weekId: "week1",
                    title: "שני",
                    dayIndex: 1,
                    totalWorkingMinutes: 480,
                },
            },
        } as Extract<Action, { type: "ADD_DAY" }>);

        expect(next.weeks["week1"].days).toEqual(["day1", "day2"]);
        expect(next.days["day2"]).toBeDefined();
    });

    it("drops a removed day from its week's day list", () => {
        const next = dayDomainReducer(storeWithWeekAndDay(), {
            type: "REMOVE_DAY",
            payload: { dayId: "day1" },
        });

        expect(next.days["day1"]).toBeUndefined();
        expect(next.weeks["week1"].days).toEqual([]);
    });

    it("drops the event record itself on REMOVE_EVENT", () => {
        const store = emptyStore();
        store.modules["mod1"] = {
            id: "mod1",
            syllabusId: "syl1",
            title: "מערך",
            events: ["ev1"],
        } as NormalizedStore["modules"][string];
        store.events["ev1"] = {
            id: "ev1",
            moduleId: "mod1",
            title: "אירוע",
        } as NormalizedStore["events"][string];

        const next = eventDomainReducer(store, {
            type: "REMOVE_EVENT",
            payload: { moduleId: "mod1", eventId: "ev1" },
        });

        expect(next.modules["mod1"].events).toEqual([]);
        expect(next.events["ev1"]).toBeUndefined();
    });

    it("drops a removed module and its events", () => {
        const store = emptyStore();
        store.syllabuses["syl1"] = {
            id: "syl1",
            curriculumId: "cur1",
            title: "סילבוס",
            modules: ["mod1"],
        } as NormalizedStore["syllabuses"][string];
        store.modules["mod1"] = {
            id: "mod1",
            syllabusId: "syl1",
            title: "מערך",
            events: ["ev1"],
        } as NormalizedStore["modules"][string];
        store.events["ev1"] = {
            id: "ev1",
            moduleId: "mod1",
            title: "אירוע",
        } as NormalizedStore["events"][string];

        const next = moduleDomainReducer(store, {
            type: "REMOVE_MODULE",
            payload: { syllabusId: "syl1", moduleId: "mod1" },
        });

        expect(next.syllabuses["syl1"].modules).toEqual([]);
        expect(next.modules["mod1"]).toBeUndefined();
        expect(next.events["ev1"]).toBeUndefined();
    });
});
