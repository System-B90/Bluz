import { asc, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
    ganttCurriculumEventConfigurationsSchema,
    ganttCurriculumEventDayMappingsSchema,
    ganttDaysSchema,
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
    ganttWeek2DaysSchema,
    ganttWeeksSchema,
} from "@/api-server/gantt/schema";
import { ganttCurriculumsSchema } from "@/api-server/gantt/schema/curriculums";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";

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
                                orderBy: [asc(ganttSyllabus2ModulesSchema.sortOrder)],
                                with: {
                                    module: {
                                        with: {
                                            m2e: {
                                                orderBy: [asc(ganttModule2EventsSchema.sortOrder)],
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

    return result as any;
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
        for (const c2sLink of source.c2s ?? []) {
            const syllabus = c2sLink.syllabus;

            await tx.insert(ganttCurriculum2SyllabusesSchema).values({
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
                        await tx
                            .insert(ganttCurriculumEventConfigurationsSchema)
                            .values({
                                curriculumId: newCurriculumId,
                                eventId: event.id,
                                allocatedDuration: config.allocatedDuration,
                                updatedAt: now,
                            });
                    }
                }
            }
        }

        // Weeks → days (deep clone, all-new ids).
        for (const c2wLink of source.c2w ?? []) {
            const week = c2wLink.week;
            const newWeekId = `w_${crypto.randomUUID()}`;

            await tx.insert(ganttWeeksSchema).values({
                id: newWeekId,
                number: week.number,
                comment: week.comment ?? "",
                weekendDuty: week.weekendDuty,
                createdAt: now,
                updatedAt: now,
            });
            await tx.insert(ganttCurriculum2WeeksSchema).values({
                curriculumId: newCurriculumId,
                weekId: newWeekId,
            });

            for (const w2dLink of week.w2d ?? []) {
                const day = w2dLink.day;
                const newDayId = `d_${crypto.randomUUID()}`;
                dayIdMap.set(day.id, newDayId);

                await tx.insert(ganttDaysSchema).values({
                    id: newDayId,
                    dayIndex: day.dayIndex,
                    totalWorkingMinutes: day.totalWorkingMinutes,
                    comment: day.comment ?? "",
                    createdAt: now,
                    updatedAt: now,
                });
                await tx.insert(ganttWeek2DaysSchema).values({
                    weekId: newWeekId,
                    dayId: newDayId,
                });
            }
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

        for (const mapping of sourceMappings) {
            const newModuleId = moduleIdMap.get(mapping.moduleId);
            const newDayId = dayIdMap.get(mapping.dayId);
            // Skip mappings whose module/day fell outside the cloned tree.
            if (!newModuleId || !newDayId) continue;

            await tx.insert(ganttCurriculumEventDayMappingsSchema).values({
                id: crypto.randomUUID(),
                curriculumId: newCurriculumId,
                moduleId: newModuleId,
                eventId: mapping.eventId
                    ? (eventIdMap.get(mapping.eventId) ?? null)
                    : null,
                dayId: newDayId,
                sortOrder: mapping.sortOrder,
            });
        }
    });

    return await getFullCurriculum(newCurriculumId);
}

export const DbCurriculum = {
    ...basicOperations,
    getItem: getFullCurriculum,
    duplicateCurriculum,
} as const;
