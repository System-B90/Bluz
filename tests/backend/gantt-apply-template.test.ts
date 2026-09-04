import { beforeEach, describe, expect, it, vi } from "vitest";

import { GanttCurriculumId, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { GanttCurriculumTemplate } from "@/api-shared/types/gantt/templates";

const weekCreate = vi.fn();
const dayUpdate = vi.fn();

vi.mock("@/api-client/gantt", () => ({
    ganttApi: {
        week: { apiCreate: (...args: Array<unknown>) => weekCreate(...args) },
        day: { apiUpdate: (...args: Array<unknown>) => dayUpdate(...args) },
    },
}));

const { seedCurriculumFromTemplate } = await import(
    "@/api-client/gantt/apply-template"
);

const CID = "c1" as unknown as GanttCurriculumId;

/** A created week comes back with one linked day per index, all at 0 minutes. */
function weekWithDays(weekNumber: number, minutes = 0) {
    return {
        id: `w${weekNumber}`,
        number: weekNumber,
        w2d: [ 0, 1, 2, 3, 4, 5, 6 ].map((dayIndex) => ({
            day: {
                id: `w${weekNumber}d${dayIndex}`,
                dayIndex,
                totalWorkingMinutes: minutes,
            },
        })),
    };
}

const template: GanttCurriculumTemplate = {
    id: "t",
    label: "t",
    weekCount: 2,
    defaultDayMinutes: {
        [ GanttDayIndex.Sunday ]: 540,
        [ GanttDayIndex.Friday ]: 300,
    },
    weekOverrides: { 1: { [ GanttDayIndex.Saturday ]: 120 } },
};

describe("seedCurriculumFromTemplate", () => {
    beforeEach(() => {
        weekCreate.mockReset();
        dayUpdate.mockReset().mockResolvedValue(undefined);
    });

    it("creates exactly weekCount weeks, numbered from 1", async () => {
        weekCreate
            .mockResolvedValueOnce(weekWithDays(1))
            .mockResolvedValueOnce(weekWithDays(2));

        await seedCurriculumFromTemplate(CID, template);

        expect(weekCreate).toHaveBeenCalledTimes(2);
        expect(weekCreate.mock.calls[ 0 ][ 0 ]).toMatchObject({
            curriculumId: CID,
            number: 1,
        });
        expect(weekCreate.mock.calls[ 1 ][ 0 ]).toMatchObject({ number: 2 });
    });

    it("flags weekendDuty only on weeks whose Saturday has minutes", async () => {
        weekCreate
            .mockResolvedValueOnce(weekWithDays(1))
            .mockResolvedValueOnce(weekWithDays(2));

        await seedCurriculumFromTemplate(CID, template);

        expect(weekCreate.mock.calls[ 0 ][ 0 ].weekendDuty).toBe(false);
        expect(weekCreate.mock.calls[ 1 ][ 0 ].weekendDuty).toBe(true);
    });

    it("sets each day's minutes from the resolved template config", async () => {
        weekCreate.mockResolvedValueOnce(weekWithDays(1));

        await seedCurriculumFromTemplate(CID, {
            ...template,
            weekCount: 1,
            weekOverrides: undefined,
        });

        const updates = Object.fromEntries(
            dayUpdate.mock.calls.map(([ p ]) => [ p.id, p.totalWorkingMinutes ]),
        );
        expect(updates.w1d0).toBe(540);
        expect(updates.w1d5).toBe(300);
        // Days the template does not mention stay at 0, which they already are.
        expect(updates.w1d1).toBeUndefined();
    });

    it("skips days already holding the target minutes", async () => {
        weekCreate.mockResolvedValueOnce(weekWithDays(1, 540));

        await seedCurriculumFromTemplate(CID, {
            ...template,
            weekCount: 1,
            defaultDayMinutes: { [ GanttDayIndex.Sunday ]: 540 },
            weekOverrides: undefined,
        });

        // Sunday matches; the other six sit at 540 and must be zeroed.
        const touched = dayUpdate.mock.calls.map(([ p ]) => p.id);
        expect(touched).not.toContain("w1d0");
        expect(touched).toHaveLength(6);
        expect(
            dayUpdate.mock.calls.every(([ p ]) => p.totalWorkingMinutes === 0),
        ).toBe(true);
    });

    it("tolerates a created week that comes back without day links", async () => {
        weekCreate.mockResolvedValueOnce({ id: "w1", number: 1 });

        await expect(
            seedCurriculumFromTemplate(CID, { ...template, weekCount: 1 }),
        ).resolves.toBeUndefined();
        expect(dayUpdate).not.toHaveBeenCalled();
    });

    it("creates nothing for a zero-week template", async () => {
        await seedCurriculumFromTemplate(CID, { ...template, weekCount: 0 });

        expect(weekCreate).not.toHaveBeenCalled();
    });
});
