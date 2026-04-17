/**
 * Name: curriculumAssignmentService.ts
 * Purpose: Business logic for managing module-to-day mappings within variable-length weeks.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { and, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { ganttModuleDayAssignmentsSchema } from "@/api-server/gantt/schema/mappings";

/**
 * 1) Getting mappings for a specific curriculum.
 * Can be filtered by weekId if needed for partial loading.
 */
export async function getModuleAssignments(curriculumId: string, weekId?: string)
{
    const filters = [ eq(ganttModuleDayAssignmentsSchema.curriculumId, curriculumId) ];

    if (weekId !== undefined)
    {
        filters.push(eq(ganttModuleDayAssignmentsSchema.weekId, weekId));
    }

    return await postgresDb.query.ganttModuleDayAssignmentsSchema.findMany({
        where: and(...filters),
    });
}

/**
 * 2) Creating a mapping.
 */
export async function createModuleAssignment(data: {
    curriculumId: string;
    moduleId: string;
    weekId: string;
    dayId: string;
    sortOrder?: number;
})
{
    return await postgresDb.insert(ganttModuleDayAssignmentsSchema).values({
        ...data,
        sortOrder: data.sortOrder ?? 0,
    }).returning();
}

/**
 * 3) Updating an existing mapping (e.g., moving a module to a different day/week).
 * Uses the composite primary key for identification.
 */
export async function updateModuleAssignment(
    curriculumId: string,
    oldMapping: { moduleId: string; weekId: string; dayId: string; },
    newValues: { weekId?: string; dayId?: string; sortOrder?: number; }
)
{
    return await postgresDb
        .update(ganttModuleDayAssignmentsSchema)
        .set({ ...newValues, updatedAt: new Date() })
        .where(
            and(
                eq(ganttModuleDayAssignmentsSchema.curriculumId, curriculumId),
                eq(ganttModuleDayAssignmentsSchema.moduleId, oldMapping.moduleId),
                eq(ganttModuleDayAssignmentsSchema.weekId, oldMapping.weekId),
                eq(ganttModuleDayAssignmentsSchema.dayId, oldMapping.dayId)
            )
        )
        .returning();
}

/**
 * 4) Reordering modules within a specific day.
 * Implements a fractional/float-based update for the sortOrder.
 */
export async function reorderModuleInDay(
    curriculumId: string,
    moduleId: string,
    weekId: string,
    dayId: string,
    newSortOrder: number
)
{
    return await postgresDb
        .update(ganttModuleDayAssignmentsSchema)
        .set({ sortOrder: newSortOrder, updatedAt: new Date() })
        .where(
            and(
                eq(ganttModuleDayAssignmentsSchema.curriculumId, curriculumId),
                eq(ganttModuleDayAssignmentsSchema.moduleId, moduleId),
                eq(ganttModuleDayAssignmentsSchema.weekId, weekId),
                eq(ganttModuleDayAssignmentsSchema.dayId, dayId)
            )
        );
}

/**
 * 5) Delete an existing mapping.
 */
export async function deleteModuleAssignment(
    curriculumId: string,
    moduleId: string,
    weekId: string,
    dayId: string
)
{
    return await postgresDb
        .delete(ganttModuleDayAssignmentsSchema)
        .where(
            and(
                eq(ganttModuleDayAssignmentsSchema.curriculumId, curriculumId),
                eq(ganttModuleDayAssignmentsSchema.moduleId, moduleId),
                eq(ganttModuleDayAssignmentsSchema.weekId, weekId),
                eq(ganttModuleDayAssignmentsSchema.dayId, dayId)
            )
        )
        .returning();
}
