import { asc, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    asWireShape,
    drizzleOperationsBuilder,
} from "@/api-server/gantt/db-base";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
    ganttCurriculumEventConfigurationsSchema,
    ganttCurriculumEventDayMappingsSchema,
    ganttDaysSchema,
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttModulesSchema,
    ganttSyllabus2ModulesSchema,
    ganttSyllabusesSchema,
    ganttWeek2DaysSchema,
    ganttWeeksSchema,
} from "@/api-server/gantt/schema";
import { ganttCurriculumsSchema } from "@/api-server/gantt/schema/curriculums";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    EventRecurrence,
    GanttCurriculum,
    GanttCurriculumId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import {
    MEAL_BREAKS_SYLLABUS_TITLE,
    MEAL_EVENT_DURATIONS_MINUTES,
    MEAL_EVENT_TITLES,
} from "@/api-shared/types/settings/meal";

const basicOperations = drizzleOperationsBuilder<
    GanttCurriculum,
    typeof ganttCurriculumsSchema,
    CreateGanttCurriculumPayload
>({
    table: ganttCurriculumsSchema,
    typeName: "גאנט",
    idPrefix: "c",
    junction: {
        table: ganttCurriculum2SyllabusesSchema,
        localKey: ganttCurriculum2SyllabusesSchema.curriculumId,
        relationKey: ganttCurriculum2SyllabusesSchema.syllabusId,
        apiKey: "s",
    },
});

async function getFullCurriculum(
    id: GanttCurriculumId,
): Promise<ApiCurriculum> {
    const result = await postgresDb.query.ganttCurriculumsSchema.findFirst({
        where: eq(ganttCurriculumsSchema.id, id),
        with: {
            c2s: {
                with: {
                    syllabus: {
                        with: {
                            s2m: {
                                orderBy: [
                                    asc(ganttSyllabus2ModulesSchema.sortOrder),
                                ],
                                with: {
                                    module: {
                                        with: {
                                            m2e: {
                                                orderBy: [
                                                    asc(
                                                        ganttModule2EventsSchema.sortOrder,
                                                    ),
                                                ],
                                                with: {
                                                    event: {
                                                        with: {
                                                            cEC: {
                                                                where: (
                                                                    c,
                                                                    { eq },
                                                                ) =>
                                                                    eq(
                                                                        c.curriculumId,
                                                                        id,
                                                                    ),
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            c2w: {
                with: {
                    week: {
                        with: {
                            w2d: {
                                with: {
                                    day: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`גאנט עם מזהה ${id} לא נמצא`);
    }

    return asWireShape<ApiCurriculum>(result);
}

/**
 * Seeds every new curriculum with a "הפסקות" syllabus/module holding 3 daily
 * meal events (breakfast/lunch/dinner). The cut planner (`cut-planner.ts`)
 * recognizes these by title and pins them to the exact clock time configured
 * in the global meal-time settings instead of stacking them.
 */
async function seedMealBreaksSyllabus(
    curriculumId: GanttCurriculumId,
): Promise<void> {
    const now = new Date();
    const syllabusId = `s_${crypto.randomUUID()}`;
    const moduleId = `m_${crypto.randomUUID()}`;

    await postgresDb.transaction(async (tx) => {
        await tx.insert(ganttSyllabusesSchema).values({
            id: syllabusId,
            title: MEAL_BREAKS_SYLLABUS_TITLE,
            createdAt: now,
            updatedAt: now,
        });
        await tx
            .insert(ganttCurriculum2SyllabusesSchema)
            .values({ curriculumId, syllabusId });

        await tx.insert(ganttModulesSchema).values({
            id: moduleId,
            title: MEAL_BREAKS_SYLLABUS_TITLE,
            createdAt: now,
            updatedAt: now,
        });
        await tx
            .insert(ganttSyllabus2ModulesSchema)
            .values({ syllabusId, moduleId, sortOrder: 0 });

        for (const [settingKey, title] of Object.entries(MEAL_EVENT_TITLES)) {
            const eventId = `e_${crypto.randomUUID()}`;
            await tx.insert(ganttEventsSchema).values({
                id: eventId,
                title,
                type: ModuleEventType.Other,
                minimumDuration:
                    MEAL_EVENT_DURATIONS_MINUTES[
                        settingKey as keyof typeof MEAL_EVENT_DURATIONS_MINUTES
                    ],
                recurrence: EventRecurrence.Daily,
                createdAt: now,
                updatedAt: now,
            });
            await tx
                .insert(ganttModule2EventsSchema)
                .values({ moduleId, eventId, sortOrder: 0 });
        }
    });
}

export type DuplicateCurriculumOverrides = {
    title?: string;
    isDraft?: boolean;
    isArchived?: boolean;
};

/**
 * Clones a curriculum into a brand-new copy (#319, #322). Syllabuses (and
 * their modules/events) are shared, not cloned — the copy is linked to the
 * same syllabus rows as the source. Weeks → days are deep-cloned with fresh
 * ids, and the per-curriculum event configurations (cEC) plus module/event →
 * day mappings (cMDA) are cloned and repointed at the copy's own curriculum
 * id / day ids. Constraints and recurrence exceptions are intentionally out
 * of scope.
 */
async function duplicateCurriculum(
    sourceId: GanttCurriculumId,
    overrides: DuplicateCurriculumOverrides = {},
): Promise<ApiCurriculum> {
    const source = await getFullCurriculum(sourceId);

    const now = new Date();
    const newCurriculumId = `c_${crypto.randomUUID()}`;

    // moduleIdMap/eventIdMap are identity maps of ids reachable from the
    // source curriculum's syllabuses — used below to filter cMDA mappings
    // down to that tree. dayIdMap maps old day id → freshly cloned day id.
    const moduleIdMap = new Map<string, string>();
    const eventIdMap = new Map<string, string>();
    const dayIdMap = new Map<string, string>();

    await postgresDb.transaction(async (tx) => {
        await tx.insert(ganttCurriculumsSchema).values({
            id: newCurriculumId,
            title: overrides.title ?? source.title,
            description: source.description,
            startDate: source.startDate,
            isDraft: overrides.isDraft ?? source.isDraft,
            isArchived: overrides.isArchived ?? source.isArchived,
            createdAt: now,
            updatedAt: now,
        });

        // Syllabuses are shared, not cloned: relink the existing syllabus (and
        // its modules/events) to the copy, and clone only the per-curriculum
        // event configs (cEC) so allocated durations stay independent.
        // Rows are collected and inserted in one statement per table — an
        // awaited insert per row made duplicating a large curriculum hundreds
        // of sequential round trips (#538 item 9).
        const c2sLinks: Array<
            typeof ganttCurriculum2SyllabusesSchema.$inferInsert
        > = [];
        const clonedConfigs: Array<
            typeof ganttCurriculumEventConfigurationsSchema.$inferInsert
        > = [];

        for (const c2sLink of source.c2s ?? []) {
            const syllabus = c2sLink.syllabus;

            c2sLinks.push({
                curriculumId: newCurriculumId,
                syllabusId: syllabus.id,
            });

            for (const s2mLink of syllabus.s2m ?? []) {
                const ganttModule = s2mLink.module;
                moduleIdMap.set(ganttModule.id, ganttModule.id);

                for (const m2eLink of ganttModule.m2e ?? []) {
                    const event = m2eLink.event;
                    eventIdMap.set(event.id, event.id);

                    // Per-curriculum allocated durations, repointed at the copy.
                    for (const config of event.cEC ?? []) {
                        clonedConfigs.push({
                            curriculumId: newCurriculumId,
                            eventId: event.id,
                            allocatedDuration: config.allocatedDuration,
                            updatedAt: now,
                        });
                    }
                }
            }
        }

        if (c2sLinks.length > 0) {
            await tx.insert(ganttCurriculum2SyllabusesSchema).values(c2sLinks);
        }
        if (clonedConfigs.length > 0) {
            await tx
                .insert(ganttCurriculumEventConfigurationsSchema)
                .values(clonedConfigs);
        }

        // Weeks → days (deep clone, all-new ids), collected per table and
        // inserted in one statement each (#538 item 9).
        const clonedWeeks: Array<typeof ganttWeeksSchema.$inferInsert> = [];
        const c2wLinks: Array<typeof ganttCurriculum2WeeksSchema.$inferInsert> =
            [];
        const clonedDays: Array<typeof ganttDaysSchema.$inferInsert> = [];
        const w2dLinks: Array<typeof ganttWeek2DaysSchema.$inferInsert> = [];

        for (const c2wLink of source.c2w ?? []) {
            const week = c2wLink.week;
            const newWeekId = `w_${crypto.randomUUID()}`;

            clonedWeeks.push({
                id: newWeekId,
                number: week.number,
                comment: week.comment ?? "",
                weekendDuty: week.weekendDuty,
                createdAt: now,
                updatedAt: now,
            });
            c2wLinks.push({
                curriculumId: newCurriculumId,
                weekId: newWeekId,
            });

            for (const w2dLink of week.w2d ?? []) {
                const day = w2dLink.day;
                const newDayId = `d_${crypto.randomUUID()}`;
                dayIdMap.set(day.id, newDayId);

                clonedDays.push({
                    id: newDayId,
                    dayIndex: day.dayIndex,
                    totalWorkingMinutes: day.totalWorkingMinutes,
                    dayEndTime: day.dayEndTime ?? null,
                    comment: day.comment ?? "",
                    createdAt: now,
                    updatedAt: now,
                });
                w2dLinks.push({ weekId: newWeekId, dayId: newDayId });
            }
        }

        if (clonedWeeks.length > 0) {
            await tx.insert(ganttWeeksSchema).values(clonedWeeks);
        }
        if (c2wLinks.length > 0) {
            await tx.insert(ganttCurriculum2WeeksSchema).values(c2wLinks);
        }
        if (clonedDays.length > 0) {
            await tx.insert(ganttDaysSchema).values(clonedDays);
        }
        if (w2dLinks.length > 0) {
            await tx.insert(ganttWeek2DaysSchema).values(w2dLinks);
        }

        // Module/event → day mappings (cMDA): clone with every id repointed so
        // the copy's events sit on the copy's own days (#322).
        const sourceMappings = await tx
            .select()
            .from(ganttCurriculumEventDayMappingsSchema)
            .where(
                eq(
                    ganttCurriculumEventDayMappingsSchema.curriculumId,
                    sourceId,
                ),
            );

        // Collected then inserted in one statement: an awaited insert per
        // mapping made duplicating a full curriculum hundreds of sequential
        // round trips (#538 item 9).
        const clonedMappings = sourceMappings.flatMap((mapping) => {
            const newModuleId = moduleIdMap.get(mapping.moduleId);
            const newDayId = dayIdMap.get(mapping.dayId);
            // Skip mappings whose module/day fell outside the cloned tree.
            if (!newModuleId || !newDayId) return [];

            return [
                {
                    id: crypto.randomUUID(),
                    curriculumId: newCurriculumId,
                    moduleId: newModuleId,
                    eventId: mapping.eventId
                        ? (eventIdMap.get(mapping.eventId) ?? null)
                        : null,
                    dayId: newDayId,
                    sortOrder: mapping.sortOrder,
                },
            ];
        });

        if (clonedMappings.length > 0) {
            await tx
                .insert(ganttCurriculumEventDayMappingsSchema)
                .values(clonedMappings);
        }
    });

    return await getFullCurriculum(newCurriculumId);
}

async function createCurriculum(data: CreateGanttCurriculumPayload) {
    const newItem = await basicOperations.createNewItem(data);
    await seedMealBreaksSyllabus(newItem.id as GanttCurriculumId);
    return newItem;
}

export const DbCurriculum = {
    ...basicOperations,
    getItem: getFullCurriculum,
    createNewItem: createCurriculum,
    duplicateCurriculum,
    seedMealBreaksSyllabus,
} as const;
