/**
 * Name: ganttConstraintService.ts
 * Purpose: Business logic for managing relational and temporal constraints for Gantt events and modules.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { eq, inArray, or } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
} from "@/api-server/gantt/schema";
import { ganttConstraintsSchema } from "@/api-server/gantt/schema/constraints";
import {
    GanttCurriculumId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

export type EntityType = "event" | "module";

/**
 * 1) Getting all constraints owned by a specific Event or Module.
 * Used to load the dependencies a specific entity has before it can be scheduled.
 */
export async function getConstraintsForOwner(
    ownerId: GanttEventId | GanttModuleId,
    ownerType: EntityType,
) {
    const condition =
        ownerType === "event"
            ? eq(ganttConstraintsSchema.ownerEventId, ownerId)
            : eq(ganttConstraintsSchema.ownerModuleId, ownerId);

    return await postgresDb.query.ganttConstraintsSchema.findMany({
        where: condition,
    });
}

/**
 * 2) Getting constraints targeting a specific Event or Module.
 * Useful for cascade checking, highlighting dependencies in the UI, or cyclic dependency resolution.
 */
export async function getConstraintsTargetingEntity(
    targetId: GanttEventId | GanttModuleId,
    targetType: EntityType,
) {
    const condition =
        targetType === "event"
            ? eq(ganttConstraintsSchema.targetEventId, targetId)
            : eq(ganttConstraintsSchema.targetModuleId, targetId);

    return await postgresDb.query.ganttConstraintsSchema.findMany({
        where: condition,
    });
}

/**
 * 3) Creating a new constraint.
 */
export async function createConstraint(
    data: typeof ganttConstraintsSchema.$inferInsert,
) {
    return (
        await postgresDb.insert(ganttConstraintsSchema).values(data).returning()
    )[0];
}

/**
 * 4) Updating an existing constraint.
 */
export async function updateConstraint(
    constraintId: string,
    newValues: Partial<typeof ganttConstraintsSchema.$inferInsert>,
) {
    return await postgresDb
        .update(ganttConstraintsSchema)
        .set({ ...newValues, updatedAt: new Date() })
        .where(eq(ganttConstraintsSchema.id, constraintId))
        .returning();
}

/**
 * 5) Delete a constraint.
 */
export async function deleteConstraint(constraintId: string) {
    return await postgresDb
        .delete(ganttConstraintsSchema)
        .where(eq(ganttConstraintsSchema.id, constraintId))
        .returning();
}

export async function getConstraintsForCurriculum(
    curriculumId: GanttCurriculumId,
) {
    // Subquery 1: Resolve all module IDs mapped to the curriculum
    const moduleIdsSubquery = postgresDb
        .select({ moduleId: ganttSyllabus2ModulesSchema.moduleId })
        .from(ganttSyllabus2ModulesSchema)
        .innerJoin(
            ganttCurriculum2SyllabusesSchema,
            eq(
                ganttCurriculum2SyllabusesSchema.syllabusId,
                ganttSyllabus2ModulesSchema.syllabusId,
            ),
        )
        .where(eq(ganttCurriculum2SyllabusesSchema.curriculumId, curriculumId));

    // Subquery 2: Resolve all event IDs mapped to the modules within the curriculum
    const eventIdsSubquery = postgresDb
        .select({ eventId: ganttModule2EventsSchema.eventId })
        .from(ganttModule2EventsSchema)
        .innerJoin(
            ganttSyllabus2ModulesSchema,
            eq(
                ganttSyllabus2ModulesSchema.moduleId,
                ganttModule2EventsSchema.moduleId,
            ),
        )
        .innerJoin(
            ganttCurriculum2SyllabusesSchema,
            eq(
                ganttCurriculum2SyllabusesSchema.syllabusId,
                ganttSyllabus2ModulesSchema.syllabusId,
            ),
        )
        .where(eq(ganttCurriculum2SyllabusesSchema.curriculumId, curriculumId));

    // Main Query: Fetch constraints matching either subquery
    return await postgresDb
        .select()
        .from(ganttConstraintsSchema)
        .where(
            or(
                inArray(
                    ganttConstraintsSchema.ownerModuleId,
                    moduleIdsSubquery,
                ),
                inArray(ganttConstraintsSchema.ownerEventId, eventIdsSubquery),
            ),
        );
}
/**
 * Name: getConstraintsForSyllabus
 * Purpose: Retrieves all constraints for any module or event within a specific syllabus using a single database query.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */
export async function getConstraintsForSyllabus(syllabusId: string) {
    // Subquery 1: Resolve all module IDs mapped directly to the syllabus
    const moduleIdsSubquery = postgresDb
        .select({ moduleId: ganttSyllabus2ModulesSchema.moduleId })
        .from(ganttSyllabus2ModulesSchema)
        .where(eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId));

    // Subquery 2: Resolve all event IDs mapped to the modules within the syllabus
    const eventIdsSubquery = postgresDb
        .select({ eventId: ganttModule2EventsSchema.eventId })
        .from(ganttModule2EventsSchema)
        .innerJoin(
            ganttSyllabus2ModulesSchema,
            eq(
                ganttSyllabus2ModulesSchema.moduleId,
                ganttModule2EventsSchema.moduleId,
            ),
        )
        .where(eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId));

    // Main Query: Fetch constraints matching either subquery
    return await postgresDb
        .select()
        .from(ganttConstraintsSchema)
        .where(
            or(
                inArray(
                    ganttConstraintsSchema.ownerModuleId,
                    moduleIdsSubquery,
                ),
                inArray(ganttConstraintsSchema.ownerEventId, eventIdsSubquery),
            ),
        );
}

/**
 * Name: getConstraintsForModule
 * Purpose: Retrieves all constraints owned by a specific module or its nested events.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */
export async function getConstraintsForModule(moduleId: GanttModuleId) {
    // Subquery: Resolve all event IDs mapped directly to the module
    const eventIdsSubquery = postgresDb
        .select({ eventId: ganttModule2EventsSchema.eventId })
        .from(ganttModule2EventsSchema)
        .where(eq(ganttModule2EventsSchema.moduleId, moduleId));

    // Main Query: Fetch constraints owned by the module explicitly, or by its events
    return await postgresDb
        .select()
        .from(ganttConstraintsSchema)
        .where(
            or(
                eq(ganttConstraintsSchema.ownerModuleId, moduleId),
                inArray(ganttConstraintsSchema.ownerEventId, eventIdsSubquery),
            ),
        );
}
