import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { curriculumEventConfigurations, moduleEvents, moduleToEvents } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateModuleEventPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumId, ModuleEvent, ModuleEventId, ModuleId } from "@/api-shared/types/gant/curriculum";
import { and, eq } from "drizzle-orm";

/**
 * Basic CRUD operations for the 'moduleEvents' table.
 * Note: This entity does not have a downstream junction table in the current hierarchy.
 */
const basicOperations = drizzleOperationsBuilder<
    ModuleEvent,
    typeof moduleEvents,
    CreateModuleEventPayload
>({
    table: moduleEvents,
    typeName: 'מופע',
    idPreffix: 'e',
    parentJunction: {
        type: 'module'
    },
});

/**
 * Associates a specific event with a module in the junction table.
 */
async function addEventToModule(moduleId: ModuleId, eventId: ModuleEventId): Promise<ModuleEvent & BaseDbDocument>
{
    try
    {
        await postgresDb.insert(moduleToEvents).values({
            moduleId: moduleId,
            eventId: eventId,
        });
        return await basicOperations.getItem(eventId);
    } catch (error: any)
    {
        const cause = error.cause as { name: string; severity: string; code: string; detail: string; };

        // Unique Violation: Event already linked to this module
        if (cause?.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`האירוע כבר משויך למערך זה`);
        }
        // Foreign Key Violation: Module or Event missing
        if (cause?.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`מערך או אירוע לא קיימים במערכת`);
        }

        throw new ClientApiError(`Failed to add event ${eventId} to module ${moduleId}`);
    }
}

/**
 * Removes the association between a module and an event.
 */
async function removeEventFromModule(moduleId: ModuleId, eventId: ModuleEventId): Promise<void>
{
    const result = await postgresDb.delete(moduleToEvents)
        .where(
            and(
                eq(moduleToEvents.moduleId, moduleId),
                eq(moduleToEvents.eventId, eventId)
            )
        )
        .returning({ deletedModuleId: moduleToEvents.moduleId });

    if (result.length === 0)
    {
        throw new ClientApiError(`No mapping found for event ${eventId} in module ${moduleId}`);
    }
}
/**
 * Retrieves the specific allocated duration for an event within a curriculum context.
 */
async function getAllocatedTime(eventId: ModuleEventId, curriculumId: CurriculumId): Promise<number>
{
    const result = await postgresDb.query.curriculumEventConfigurations.findFirst({
        where: and(
            eq(curriculumEventConfigurations.curriculumId, curriculumId),
            eq(curriculumEventConfigurations.eventId, eventId)
        ),
        columns: {
            allocatedDuration: true
        }
    });

    return result?.allocatedDuration ?? 0;
}

/**
 * Sets or updates the allocated duration for a specific event in a curriculum.
 * Uses an upsert strategy to maintain data integrity.
 */
async function setAllocatedTime(
    eventId: ModuleEventId,
    curriculumId: CurriculumId,
    duration: number
): Promise<void>
{
    await postgresDb
        .insert(curriculumEventConfigurations)
        .values({
            curriculumId,
            eventId,
            allocatedDuration: duration,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                curriculumEventConfigurations.curriculumId,
                curriculumEventConfigurations.eventId
            ],
            set: {
                allocatedDuration: duration,
                updatedAt: new Date()
            },
        });
}

export const DbModuleEvent = {
    ...basicOperations,
    linkItem: addEventToModule,
    unlinkItem: removeEventFromModule,
    getAllocatedTime,
    setAllocatedTime,
} as const;
