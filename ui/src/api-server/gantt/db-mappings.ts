/**
 * Name: curriculumAssignmentService.ts
 * Purpose: Business logic for managing module-to-day mappings within variable-length weeks.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { ganttWeek2DaysSchema } from "@/api-server/gantt/schema/junctions";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import {
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

/**
 * 1) Getting mappings for a specific curriculum.
 * Can be filtered by dayIds and/or weekIds for partial loading.
 * weekIds are resolved to dayIds via the week->day junction table (w2d),
 * then combined with any explicit dayIds using AND logic.
 */
export async function getModuleDayMappingsForCurriculum(
    curriculumId: GanttCurriculumId,
    { dayIds, weekIds }: { dayIds?: Array<GanttDayId>; weekIds?: Array<GanttWeekId> },
) {
    const filters = [
        eq(ganttCurriculumEventDayMappingsSchema.curriculumId, curriculumId),
    ];

    let resolvedDayIds = dayIds;

    if (weekIds !== undefined && weekIds.length > 0) {
        const w2dRows = await postgresDb
            .select({ dayId: ganttWeek2DaysSchema.dayId })
            .from(ganttWeek2DaysSchema)
            .where(inArray(ganttWeek2DaysSchema.weekId, weekIds));

        const weekDayIds = w2dRows.map((r) => r.dayId) as Array<GanttDayId>;

        resolvedDayIds =
            resolvedDayIds !== undefined && resolvedDayIds.length > 0
                ? resolvedDayIds.filter((id) => weekDayIds.includes(id))
                : weekDayIds;
    }

    if (resolvedDayIds !== undefined && resolvedDayIds.length > 0) {
        filters.push(
            inArray(ganttCurriculumEventDayMappingsSchema.dayId, resolvedDayIds),
        );
    }

    return await postgresDb.query.ganttCurriculumEventDayMappingsSchema.findMany(
        {
            where: and(...filters),
        },
    );
}

/**
 * 2) Creating a mapping.
 */
export async function createCurriculumModuleDayMapping(data: {
    curriculumId: GanttCurriculumId;
    moduleId: GanttModuleId;
    eventId?: GanttEventId | null;
    dayId: GanttDayId;
    sortOrder?: number;
}) {
    const { eventId, moduleId, sortOrder, ...v } = { ...data };

    return await postgresDb
        .insert(ganttCurriculumEventDayMappingsSchema)
        .values({
            ...v,
            moduleId,
            eventId,
            sortOrder: sortOrder ?? 0,
        })
        .returning();
}

/**
 * 3) Updating an existing mapping (e.g., moving a module to a different day/week).
 * Uses the composite primary key for identification.
 */
export async function updateCurriculumModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    oldMapping: { dayId: GanttDayId },
    newValues: { dayId?: GanttDayId; sortOrder?: number },
) {
    return await postgresDb
        .update(ganttCurriculumEventDayMappingsSchema)
        .set({ ...newValues, updatedAt: new Date() })
        .where(
            and(
                eq(
                    ganttCurriculumEventDayMappingsSchema.curriculumId,
                    curriculumId,
                ),
                eq(ganttCurriculumEventDayMappingsSchema.moduleId, moduleId),
                eventId
                    ? eq(ganttCurriculumEventDayMappingsSchema.eventId, eventId)
                    : isNull(ganttCurriculumEventDayMappingsSchema.eventId),
                eq(
                    ganttCurriculumEventDayMappingsSchema.dayId,
                    oldMapping.dayId,
                ),
            ),
        )
        .returning();
}

/**
 * 4) Reordering modules within a specific day.
 * Implements a fractional/float-based update for the sortOrder.
 */
export async function reorderCurriculumModuleMappingInDay(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    dayId: GanttDayId,
    newSortOrder: number,
) {
    return await postgresDb
        .update(ganttCurriculumEventDayMappingsSchema)
        .set({ sortOrder: newSortOrder, updatedAt: new Date() })
        .where(
            and(
                eq(
                    ganttCurriculumEventDayMappingsSchema.curriculumId,
                    curriculumId,
                ),
                eq(ganttCurriculumEventDayMappingsSchema.moduleId, moduleId),
                eventId
                    ? eq(ganttCurriculumEventDayMappingsSchema.eventId, eventId)
                    : isNull(ganttCurriculumEventDayMappingsSchema.eventId),
                eq(ganttCurriculumEventDayMappingsSchema.dayId, dayId),
            ),
        );
}

/**
 * 5) Delete an existing mapping.
 */
export async function deleteCurriculumModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    dayId: GanttDayId,
) {
    return await postgresDb
        .delete(ganttCurriculumEventDayMappingsSchema)
        .where(
            and(
                eq(
                    ganttCurriculumEventDayMappingsSchema.curriculumId,
                    curriculumId,
                ),
                eq(ganttCurriculumEventDayMappingsSchema.moduleId, moduleId),
                eventId
                    ? eq(ganttCurriculumEventDayMappingsSchema.eventId, eventId)
                    : isNull(ganttCurriculumEventDayMappingsSchema.eventId),
                eq(ganttCurriculumEventDayMappingsSchema.dayId, dayId),
            ),
        )
        .returning();
}
