import { eq, inArray, or } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
} from "@/api-server/gantt/schema";
import { ganttConstraintsSchema } from "@/api-server/gantt/schema/constraints";
import { ClientApiError } from "@/api-shared/errors";
import { CreateConstraintPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

/**
 * Represents the types of Gantt entities that can own or be targeted by a constraint.
 */
export type EntityType = "event" | "module";

/**
 * Retrieves all constraints owned by a specific Event or Module.
 * Used to load the dependencies a specific entity has before it can be scheduled.
 * 
 * @param ownerId - The ID of the owner event or module.
 * @param ownerType - The entity type ("event" or "module").
 * @returns An array of constraints owned by the entity.
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
 * Retrieves constraints targeting a specific Event or Module.
 * Useful for cascade checking, highlighting dependencies in the UI, or cyclic dependency resolution.
 * 
 * @param targetId - The ID of the target event or module.
 * @param targetType - The entity type ("event" or "module").
 * @returns An array of constraints targeting the entity.
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
 * Creates a new constraint in the database.
 * 
 * @param data - The constraint insert payload.
 * @returns The created constraint record.
 */
export async function createConstraint(
    data: typeof ganttConstraintsSchema.$inferInsert,
) {
    return (
        await postgresDb.insert(ganttConstraintsSchema).values(data).returning()
    )[0];
}

/**
 * Validates a client (or assistant) constraint payload and maps it to the
 * row shape. Shared by the REST route and the AI tool so both enforce the
 * same owner/target rules.
 */
export function constraintInsertFromPayload(
    body: CreateConstraintPayload,
): typeof ganttConstraintsSchema.$inferInsert {
    if (!body.type) {
        throw new ClientApiError("Missing required field: type.");
    }
    if (!body.id) {
        throw new ClientApiError("Missing required field: id.");
    }
    if (!body.ownerEventId && !body.ownerModuleId) {
        throw new ClientApiError(
            "A constraint must have an owner identified by ownerEventId or ownerModuleId.",
        );
    }
    if (body.type === "RELATIONAL" && !body.targetId) {
        throw new ClientApiError(
            "Relational constraints must specify a targetId.",
        );
    }

    const creationData: typeof ganttConstraintsSchema.$inferInsert = {
        id: body.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: body.type,
        ownerEventId: body.ownerType === "event" ? body.ownerEventId : undefined,
        ownerModuleId:
            body.ownerType === "module" ? body.ownerModuleId : undefined,
        relation: body.type === "RELATIONAL" ? body.relation : undefined,
        minDelayDays: body.type === "RELATIONAL" ? body.minDelayDays : undefined,
        maxDelayDays: body.type === "RELATIONAL" ? body.maxDelayDays : undefined,
    };
    if (body.type === "TEMPORAL") {
        creationData.allowedDays = body.allowedDays;
        creationData.forbiddenDays = body.forbiddenDays;
    } else {
        creationData[
            body.targetType === "event" ? "targetEventId" : "targetModuleId"
        ] = body.targetId;
    }
    return creationData;
}

/**
 * Updates an existing constraint with new values.
 * 
 * @param constraintId - The UUID of the constraint to update.
 * @param newValues - The partial payload of values to update.
 * @returns The updated constraint record.
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
 * Deletes a constraint from the database by its identifier.
 * 
 * @param constraintId - The UUID of the constraint to delete.
 * @returns The deleted constraint record.
 */
export async function deleteConstraint(constraintId: string) {
    const deleted = await postgresDb
        .delete(ganttConstraintsSchema)
        .where(eq(ganttConstraintsSchema.id, constraintId))
        .returning();
    // An empty array meant "deleted nothing" but reached the caller as a 200
    // success, so a wrong id looked like a completed delete (#538 item 11).
    if (deleted.length === 0) {
        throw new ClientApiError(`אילוץ ${constraintId} לא נמצא למחיקה`);
    }
    return deleted;
}

/**
 * Retrieves all constraints associated with a specific curriculum.
 * Resolves constraints owned by any modules or events mapped to the curriculum.
 * 
 * @param curriculumId - The curriculum identifier.
 * @returns An array of constraints for the curriculum.
 */
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
 * Retrieves all constraints for any module or event within a specific syllabus using a single database query.
 * 
 * @param syllabusId - The unique identifier of the syllabus.
 * @returns An array of constraints found.
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
 * Retrieves all constraints owned by a specific module or its nested events.
 * 
 * @param moduleId - The unique identifier of the module.
 * @returns An array of constraints found.
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
