import { and, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    drizzleOperationsBuilder,
    sanitizeCreatePayload,
} from "@/api-server/gantt/db-base";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
    ganttWeek2DaysSchema,
} from "@/api-server/gantt/schema";
import { ganttDaysSchema } from "@/api-server/gantt/schema/days";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { ganttWeeksSchema } from "@/api-server/gantt/schema/weeks";
import { ClientApiError } from "@/api-shared/errors";
import { getDefaultWorkingMinutesForDay } from "@/api-shared/gantt/week-defaults";
import {
    ApiCurriculumDay,
    ApiCurriculumWeek,
} from "@/api-shared/types/gantt/api-layer";
import { CreateGanttWeekPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttDayIndex,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { MEAL_BREAKS_SYLLABUS_TITLE } from "@/api-shared/types/settings/meal";

const basicOperations = drizzleOperationsBuilder<
    GanttWeek,
    typeof ganttWeeksSchema,
    CreateGanttWeekPayload
>({
    table: ganttWeeksSchema,
    typeName: "שבוע",
    idPrefix: "w",
    labelColumn: ganttWeeksSchema.number,
    junction: {
        table: ganttWeek2DaysSchema,
        localKey: ganttWeek2DaysSchema.weekId,
        relationKey: ganttWeek2DaysSchema.dayId,
        apiKey: "days",
    },
    parentJunction: {
        table: ganttCurriculum2WeeksSchema,
        parentKey: "curriculumId",
        selfKey: "weekId",
        cardinality: "one",
    },
});

async function getFullWeek(id: GanttWeekId): Promise<ApiCurriculumWeek> {
    const result = await postgresDb.query.ganttWeeksSchema.findFirst({
        where: eq(ganttWeeksSchema.id, id),
        with: {
            w2d: {
                with: {
                    day: true,
                },
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`שבוע עם מזהה ${id} לא נמצא`);
    }

    await basicOperations.attachParentIds([result]);
    return result as unknown as ApiCurriculumWeek;
}

/**
 * The number a newly created week should take: one past the highest number
 * already in the curriculum, or 1 for the first week (and for a week created
 * without a parent curriculum).
 */
async function nextWeekNumber(curriculumId?: string): Promise<number> {
    if (!curriculumId) return 1;

    const links = await postgresDb.query.ganttCurriculum2WeeksSchema.findMany({
        where: eq(ganttCurriculum2WeeksSchema.curriculumId, curriculumId),
        with: { week: true },
    });
    const highest = links.reduce(
        (max, link) => Math.max(max, link.week?.number ?? 0),
        0,
    );
    return highest + 1;
}

async function createWeek(
    data: CreateGanttWeekPayload,
): Promise<ApiCurriculumWeek> {
    const DAY_INDICES = [
        GanttDayIndex.Sunday,
        GanttDayIndex.Monday,
        GanttDayIndex.Tuesday,
        GanttDayIndex.Wednesday,
        GanttDayIndex.Thursday,
        GanttDayIndex.Friday,
        GanttDayIndex.Saturday,
    ];

    const { curriculumId, ...weekData } = data as CreateGanttWeekPayload & {
        curriculumId?: string;
    };
    const weekId = `w_${crypto.randomUUID()}`;
    const now = new Date();

    // `number` is NOT NULL with no default, so an omitted one used to reach the
    // insert and come back as a bare 500 (#434). It is a positional field, not
    // a caller decision, so derive it: the next slot in the curriculum.
    const number =
        weekData.number ?? (await nextWeekNumber(curriculumId));

    const insertData = sanitizeCreatePayload(
        ganttWeeksSchema,
        { ...weekData, number },
        "שבוע",
    );

    return await postgresDb.transaction(async (tx) => {
        const [newWeek] = await tx
            .insert(ganttWeeksSchema)
            .values({
                ...insertData,
                number,
                id: weekId,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (curriculumId) {
            await tx
                .insert(ganttCurriculum2WeeksSchema)
                .values({ curriculumId, weekId });
        }

        const insertedDays = await Promise.all(
            DAY_INDICES.map(async (dayIndex) => {
                const dayId = `d_${crypto.randomUUID()}`;
                const [day] = await tx
                    .insert(ganttDaysSchema)
                    .values({
                        id: dayId,
                        dayIndex,
                        totalWorkingMinutes:
                            getDefaultWorkingMinutesForDay(dayIndex),
                        createdAt: now,
                        updatedAt: now,
                    })
                    .returning();
                await tx
                    .insert(ganttWeek2DaysSchema)
                    .values({ weekId, dayId });
                return day;
            }),
        );

        const sortedDays = insertedDays.sort((a, b) => a.dayIndex - b.dayIndex);

        // First week added to the curriculum: anchor the auto-seeded meal
        // events (if any) onto this week's Sunday so the cut planner's
        // Daily-recurrence echoes cover every subsequent day. Guarded by "no
        // existing mapping for that module yet" so this only ever runs once.
        if (curriculumId) {
            const c2sLinks = await tx.query.ganttCurriculum2SyllabusesSchema.findMany({
                where: eq(ganttCurriculum2SyllabusesSchema.curriculumId, curriculumId),
                with: {
                    syllabus: {
                        with: { s2m: { with: { module: { with: { m2e: true } } } } },
                    },
                },
            });
            const mealSyllabus = c2sLinks.find(
                (link) => link.syllabus.title === MEAL_BREAKS_SYLLABUS_TITLE,
            )?.syllabus;
            const mealModuleLink = mealSyllabus?.s2m[0];

            if (mealModuleLink) {
                const existingMapping = await tx.query.ganttCurriculumEventDayMappingsSchema.findFirst({
                    where: and(
                        eq(ganttCurriculumEventDayMappingsSchema.curriculumId, curriculumId),
                        eq(ganttCurriculumEventDayMappingsSchema.moduleId, mealModuleLink.moduleId),
                    ),
                });

                if (!existingMapping) {
                    const sundayDay = sortedDays.find((d) => d.dayIndex === GanttDayIndex.Sunday);
                    if (sundayDay) {
                        for (const m2eLink of mealModuleLink.module.m2e) {
                            await tx.insert(ganttCurriculumEventDayMappingsSchema).values({
                                id: crypto.randomUUID(),
                                curriculumId,
                                moduleId: mealModuleLink.moduleId,
                                eventId: m2eLink.eventId,
                                dayId: sundayDay.id,
                                sortOrder: 0,
                            });
                        }
                    }
                }
            }
        }

        const w2d: ApiCurriculumWeek["w2d"] = sortedDays.map((day) => ({
            day: day as unknown as ApiCurriculumDay,
            weekId,
            dayId: day.id,
        }));

        return { ...newWeek, w2d } as unknown as ApiCurriculumWeek;
    });
}

export const DbWeek = {
    getItem: getFullWeek,
    ...basicOperations,
    createNewItem: createWeek,
} as const;
