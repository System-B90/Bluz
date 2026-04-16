/**
 * Name: curriculumAssignmentService.ts
 * Purpose: Business logic for managing module-to-day mappings within variable-length weeks.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { and, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/curriculum";
import { curriculumModuleDayAssignments } from "@/api-server/curriculum/schema";

/**
 * 1) Getting mappings for a specific curriculum.
 * Can be filtered by weekIndex if needed for partial loading.
 */
export async function getModuleAssignments(curriculumId: string, weekIndex?: number)
{
    const filters = [ eq(curriculumModuleDayAssignments.curriculumId, curriculumId) ];

    if (weekIndex !== undefined)
    {
        filters.push(eq(curriculumModuleDayAssignments.weekIndex, weekIndex));
    }

    return await postgresDb.query.curriculumModuleDayAssignments.findMany({
        where: and(...filters),
    });
}

/**
 * 2) Creating a mapping.
 */
export async function createModuleAssignment(data: {
    curriculumId: string;
    moduleId: string;
    weekIndex: number;
    dayIndex: number;
    sortOrder?: number;
})
{
    return await postgresDb.insert(curriculumModuleDayAssignments).values({
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
    oldMapping: { moduleId: string; weekIndex: number; dayIndex: number; },
    newValues: { weekIndex?: number; dayIndex?: number; sortOrder?: number; }
)
{
    return await postgresDb
        .update(curriculumModuleDayAssignments)
        .set({ ...newValues, updatedAt: new Date() })
        .where(
            and(
                eq(curriculumModuleDayAssignments.curriculumId, curriculumId),
                eq(curriculumModuleDayAssignments.moduleId, oldMapping.moduleId),
                eq(curriculumModuleDayAssignments.weekIndex, oldMapping.weekIndex),
                eq(curriculumModuleDayAssignments.dayIndex, oldMapping.dayIndex)
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
    weekIndex: number,
    dayIndex: number,
    newSortOrder: number
)
{
    return await postgresDb
        .update(curriculumModuleDayAssignments)
        .set({ sortOrder: newSortOrder, updatedAt: new Date() })
        .where(
            and(
                eq(curriculumModuleDayAssignments.curriculumId, curriculumId),
                eq(curriculumModuleDayAssignments.moduleId, moduleId),
                eq(curriculumModuleDayAssignments.weekIndex, weekIndex),
                eq(curriculumModuleDayAssignments.dayIndex, dayIndex)
            )
        );
}

/**
 * 5) Delete an existing mapping.
 */
export async function deleteModuleAssignment(
    curriculumId: string,
    moduleId: string,
    weekIndex: number,
    dayIndex: number
)
{
    return await postgresDb
        .delete(curriculumModuleDayAssignments)
        .where(
            and(
                eq(curriculumModuleDayAssignments.curriculumId, curriculumId),
                eq(curriculumModuleDayAssignments.moduleId, moduleId),
                eq(curriculumModuleDayAssignments.weekIndex, weekIndex),
                eq(curriculumModuleDayAssignments.dayIndex, dayIndex)
            )
        )
        .returning();
}
