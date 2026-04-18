/**
 * Name: curriculumAssignmentService.ts
 * Purpose: Business logic for managing module-to-day mappings within variable-length weeks.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { and, eq, inArray } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { ganttCurriculumModuleDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import
{
    GanttCurriculumId,
    GanttDayId,
    GanttModuleId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

/**
 * 1) Getting mappings for a specific curriculum.
 * Can be filtered by weekId if needed for partial loading.
 */
export async function getModuleDayMappingsForCurriculum(
    curriculumId: GanttCurriculumId,
    {
        _weekIds,
        dayIds,
    }: { _weekIds?: Array<GanttWeekId>; dayIds?: Array<GanttDayId> },
) {
    const filters = [
        eq(ganttCurriculumModuleDayMappingsSchema.curriculumId, curriculumId),
    ];

    if (dayIds !== undefined) {
        filters.push(inArray(ganttCurriculumModuleDayMappingsSchema.dayId, dayIds));
    }

    // TODO: Implement
    // if (weekIds !== undefined)
    // {
    //     filters.push(inArray(ganttCurriculumModuleDayMappingsSchema.weekId, weekIds));
    // }

    return await postgresDb.query.ganttModuleDayAssignmentsSchema.findMany({
        where: and(...filters),
    });
}

/**
 * 2) Creating a mapping.
 */
export async function createCurriculumModuleDayMapping(data: {
  curriculumId: GanttCurriculumId;
  moduleId: GanttModuleId;
  dayId: GanttDayId;
  sortOrder?: number;
}) {
    return await postgresDb
        .insert(ganttCurriculumModuleDayMappingsSchema)
        .values({
            ...data,
            sortOrder: data.sortOrder ?? 0,
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
    oldMapping: { dayId: GanttDayId },
    newValues: { dayId?: GanttDayId; sortOrder?: number },
) {
    return await postgresDb
        .update(ganttCurriculumModuleDayMappingsSchema)
        .set({ ...newValues, updatedAt: new Date() })
        .where(
            and(
                eq(ganttCurriculumModuleDayMappingsSchema.curriculumId, curriculumId),
                eq(ganttCurriculumModuleDayMappingsSchema.moduleId, moduleId),
                eq(ganttCurriculumModuleDayMappingsSchema.dayId, oldMapping.dayId),
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
    dayId: GanttDayId,
    newSortOrder: number,
) {
    return await postgresDb
        .update(ganttCurriculumModuleDayMappingsSchema)
        .set({ sortOrder: newSortOrder, updatedAt: new Date() })
        .where(
            and(
                eq(ganttCurriculumModuleDayMappingsSchema.curriculumId, curriculumId),
                eq(ganttCurriculumModuleDayMappingsSchema.moduleId, moduleId),
                eq(ganttCurriculumModuleDayMappingsSchema.dayId, dayId),
            ),
        );
}

/**
 * 5) Delete an existing mapping.
 */
export async function deleteCurriculumModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    dayId: GanttDayId,
) {
    return await postgresDb
        .delete(ganttCurriculumModuleDayMappingsSchema)
        .where(
            and(
                eq(ganttCurriculumModuleDayMappingsSchema.curriculumId, curriculumId),
                eq(ganttCurriculumModuleDayMappingsSchema.moduleId, moduleId),
                eq(ganttCurriculumModuleDayMappingsSchema.dayId, dayId),
            ),
        )
        .returning();
}
