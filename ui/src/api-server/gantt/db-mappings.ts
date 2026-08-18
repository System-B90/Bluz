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
 * Retrieves curriculum module/event day mappings for a specific curriculum.
 * Can be filtered by dayIds and/or weekIds for partial loading.
 * weekIds are resolved to dayIds via the week->day junction table,
 * then combined with any explicit dayIds using AND logic.
 * 
 * @param curriculumId - The curriculum identifier.
 * @param filters - Optional filters for dayIds and weekIds.
 * @returns An array of mapping records.
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
            resolvedDayIds !== undefined
                ? resolvedDayIds.filter((id) => weekDayIds.includes(id))
                : weekDayIds;
    }

    // An empty set of days is a real filter — "these days, of which there are
    // none" — not the absence of one. Dropping it here would widen the query
    // back to every mapping in the curriculum.
    if (resolvedDayIds !== undefined && resolvedDayIds.length === 0) {
        return [];
    }
    if (resolvedDayIds !== undefined) {
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
 * Creates a new module or event day mapping.
 * 
 * @param data - The details for the new mapping.
 * @returns The created mapping record.
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
 * Updates an existing mapping (e.g., moving a module to a different day/week).
 * Uses the composite primary key fields for identification.
 * 
 * @param curriculumId - The curriculum identifier.
 * @param moduleId - The module identifier.
 * @param eventId - The event identifier (or null if mapping a module only).
 * @param oldMapping - The old day mapping coordinates.
 * @param newValues - The new values to apply.
 * @returns The updated mapping record.
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
 * Reorders modules or events within a specific day.
 * Implements a fractional/float-based update for the sortOrder.
 * 
 * @param curriculumId - The curriculum identifier.
 * @param moduleId - The module identifier.
 * @param eventId - The event identifier (or null if reordering a module mapping).
 * @param dayId - The day identifier.
 * @param newSortOrder - The new sort order weight.
 * @returns The database update operation result.
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
 * Sets which day an event (or module) falls on for a curriculum: moves the
 * existing mapping if one is already present for this
 * (curriculumId, moduleId, eventId), otherwise creates one. This is the
 * single write path event-scoped callers (the `events/[id]/day` route) use —
 * they know only the target day, not whichever day the mapping used to sit
 * on, so they cannot supply `oldMapping` the way the curriculum-scoped PATCH
 * route requires.
 *
 * @param curriculumId - The curriculum identifier.
 * @param moduleId - The module identifier.
 * @param eventId - The event identifier (or null if mapping a module only).
 * @param dayId - The day to place the event/module on.
 * @param sortOrder - Optional sort order weight (defaults to 0 on create).
 * @returns The created or updated mapping record.
 */
export async function setEventDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    dayId: GanttDayId,
    sortOrder?: number,
) {
    const existing = await postgresDb.query.ganttCurriculumEventDayMappingsSchema.findFirst({
        where: and(
            eq(ganttCurriculumEventDayMappingsSchema.curriculumId, curriculumId),
            eq(ganttCurriculumEventDayMappingsSchema.moduleId, moduleId),
            eventId
                ? eq(ganttCurriculumEventDayMappingsSchema.eventId, eventId)
                : isNull(ganttCurriculumEventDayMappingsSchema.eventId),
        ),
    });

    if (!existing) {
        return await createCurriculumModuleDayMapping({
            curriculumId,
            moduleId,
            eventId,
            dayId,
            sortOrder,
        });
    }

    return await updateCurriculumModuleDayMapping(
        curriculumId,
        moduleId,
        eventId,
        { dayId: existing.dayId },
        { dayId, ...(sortOrder !== undefined ? { sortOrder } : {}) },
    );
}

/**
 * Clears an event's (or module's) day placement for a curriculum, regardless
 * of which day it currently sits on.
 *
 * @param curriculumId - The curriculum identifier.
 * @param moduleId - The module identifier.
 * @param eventId - The event identifier (or null if unsetting a module mapping).
 * @returns The deleted mapping record.
 */
export async function unsetEventDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
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
            ),
        )
        .returning();
}

/**
 * Deletes an existing curriculum day mapping.
 * 
 * @param curriculumId - The curriculum identifier.
 * @param moduleId - The module identifier.
 * @param eventId - The event identifier (or null if deleting a module mapping).
 * @param dayId - The day identifier.
 * @returns The deleted mapping record.
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
