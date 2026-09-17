import { and, eq, isNull } from "drizzle-orm";

import { GanttDbExecutor, postgresDb } from "@/api-server/gantt";
import { createCurriculumModuleDayMapping } from "@/api-server/gantt/db-mappings";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { ganttEventRecurrenceExceptionsSchema } from "@/api-server/gantt/schema";
import {
    EventRecurrence,
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

/**
 * Retrieves every recurrence exception (deleted/materialized occurrence day)
 * for a curriculum, keyed for cheap client-side lookup.
 */
export async function listRecurrenceExceptionsForCurriculum(
    curriculumId: GanttCurriculumId,
) {
    return await postgresDb.query.ganttEventRecurrenceExceptionsSchema.findMany(
        {
            where: eq(
                ganttEventRecurrenceExceptionsSchema.curriculumId,
                curriculumId,
            ),
        },
    );
}

/**
 * Removes a single recurring occurrence: marks the day as excepted so the
 * event no longer echoes onto it, without touching the source event.
 */
export async function createRecurrenceException(data: {
    curriculumId: GanttCurriculumId;
    eventId: GanttEventId;
    dayId: GanttDayId;
    materializedEventId?: GanttEventId | null;
}, executor: GanttDbExecutor = postgresDb) {
    const [exception] = await executor
        .insert(ganttEventRecurrenceExceptionsSchema)
        .values(data)
        .onConflictDoNothing()
        .returning();

    return exception;
}

/**
 * Materializes a recurring occurrence into its own standalone event: copies
 * the source event's fields (recurrence reset to "none"), links the copy to
 * the same module, maps it onto the occurrence day, and excepts the source
 * event from echoing onto that day going forward.
 */
export async function materializeRecurrenceOccurrence(data: {
    curriculumId: GanttCurriculumId;
    moduleId: GanttModuleId;
    eventId: GanttEventId;
    dayId: GanttDayId;
}) {
    const { curriculumId, moduleId, eventId, dayId } = data;

    const sourceEvent = await DbModuleEvent.getItem(eventId);

    // The three writes below are one decision. Run untransacted, a failure
    // partway through left a dangling standalone event, or an exception row
    // pointing at nothing (#518).
    return await postgresDb.transaction(async (tx) => {
        const newEvent = await DbModuleEvent.createNewItem({
            title: sourceEvent.title,
            type: sourceEvent.type,
            minimumDuration: sourceEvent.minimumDuration,
            allocatedDuration: 0,
            orchestratorId: sourceEvent.orchestratorId,
            recommendedLecturerIds: sourceEvent.recommendedLecturerIds,
            systemRequirements: sourceEvent.systemRequirements,
            roomRequirement: sourceEvent.roomRequirement,
            recurrence: EventRecurrence.None,
            recurrenceStartDate: null,
            recurrenceEndDate: null,
            isCritical: sourceEvent.isCritical,
            isPaWindow: sourceEvent.isPaWindow,
            splitAcrossBreaks: sourceEvent.splitAcrossBreaks,
            comment: sourceEvent.comment,
            shuffles: sourceEvent.shuffles,
            // Materializing one occurrence detaches it from the recurrence,
            // not from its shuffle group: the standalone copy belongs to the
            // same shuffle's timeline as the event it came from (#699).
            groupId: sourceEvent.groupId,
            hiveSubjectId: sourceEvent.hiveSubjectId,
            hiveModuleId: sourceEvent.hiveModuleId,
            hiveLessonId: sourceEvent.hiveLessonId,
            moduleId,
        }, tx);

        const [mapping] = await createCurriculumModuleDayMapping({
            curriculumId,
            moduleId,
            eventId: newEvent.id as GanttEventId,
            dayId,
        }, tx);

        await createRecurrenceException({
            curriculumId,
            eventId,
            dayId,
            materializedEventId: newEvent.id as GanttEventId,
        }, tx);

        return { event: newEvent, mapping };
    });
}

/**
 * Restores a skipped occurrence: drops the exception so the event echoes onto
 * that day again (#469). Materialized occurrences are left alone — their
 * standalone event still holds the day, so removing the exception would
 * double-book it. Returns whether a row was actually removed.
 */
export async function deleteRecurrenceException(data: {
    curriculumId: GanttCurriculumId;
    eventId: GanttEventId;
    dayId: GanttDayId;
}): Promise<boolean> {
    const removed = await postgresDb
        .delete(ganttEventRecurrenceExceptionsSchema)
        .where(
            and(
                eq(
                    ganttEventRecurrenceExceptionsSchema.curriculumId,
                    data.curriculumId,
                ),
                eq(ganttEventRecurrenceExceptionsSchema.eventId, data.eventId),
                eq(ganttEventRecurrenceExceptionsSchema.dayId, data.dayId),
                isNull(
                    ganttEventRecurrenceExceptionsSchema.materializedEventId,
                ),
            ),
        )
        .returning();

    return removed.length > 0;
}
