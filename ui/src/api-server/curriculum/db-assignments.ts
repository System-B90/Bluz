/**
 * Name: curriculumAssignmentService.ts
 * Purpose: Business logic for managing module-to-day assignments.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { postgresDb } from "@/api-server/curriculum";
import { curriculumModuleDayAssignments } from "@/api-server/curriculum/schema";

export async function assignModuleToDay(
    curriculumId: string,
    moduleId: string,
    weekIndex: number,
    dayIndex: number
)
{
    return await postgresDb.insert(curriculumModuleDayAssignments)
        .values({
            curriculumId,
            moduleId,
            weekIndex,
            dayIndex,
            sortOrder: Date.now(), // Simplified float-based ordering
        })
        .onConflictDoUpdate({
            target: [
                curriculumModuleDayAssignments.curriculumId,
                curriculumModuleDayAssignments.weekIndex,
                curriculumModuleDayAssignments.dayIndex,
                curriculumModuleDayAssignments.moduleId
            ],
            set: { updatedAt: new Date() }
        });
}
