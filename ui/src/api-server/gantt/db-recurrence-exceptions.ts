import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
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
}) {
    const [exception] = await postgresDb
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
        isCritical: sourceEvent.isCritical,
        isPaWindow: sourceEvent.isPaWindow,
        comment: sourceEvent.comment,
        shuffles: sourceEvent.shuffles,
        hiveSubjectId: sourceEvent.hiveSubjectId,
        hiveModuleId: sourceEvent.hiveModuleId,
        hiveLessonId: sourceEvent.hiveLessonId,
        moduleId,
    });

    const [mapping] = await createCurriculumModuleDayMapping({
        curriculumId,
        moduleId,
        eventId: newEvent.id as GanttEventId,
        dayId,
    });

    await createRecurrenceException({ curriculumId, eventId, dayId });

    return { event: newEvent, mapping };
}
