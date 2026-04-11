import { postgresDb } from "@/api-server/curriculum";
import { drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { modules, moduleEvents, moduleToEvents } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateModulePayload } from "@/api-shared/types/gant/create-payloads";
import { Module, ModuleId, ModuleEventId } from "@/api-shared/types/gant/curriculum";
import { eq, and } from "drizzle-orm";

const basicOperations = drizzleOperationsBuilder<
    Module,
    typeof modules,
    CreateModulePayload
>({
    table: modules,
    typeName: 'מודול',
    junction: {
        table: moduleToEvents,
        localKey: moduleToEvents.moduleId,
        relationKey: moduleToEvents.eventId,
        apiKey: "events"
    },
    parentJunction: {
        type: 'syllabus'
    },
});

/**
 * Associates a specific event with a module in the junction table.
 */
async function addEventToModule(moduleId: ModuleId, eventId: ModuleEventId): Promise<void>
{
    try
    {
        await postgresDb.insert(moduleToEvents).values({
            moduleId: moduleId,
            eventId: eventId,
        });
    } catch (error: any)
    {
        // Unique Violation: Event already linked to this module
        if (error.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`האירוע כבר משויך למודול זה`);
        }
        // Foreign Key Violation: Module or Event missing
        if (error.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`מודול או אירוע לא קיימים במערכת`);
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

export const DbModule = {
    ...basicOperations,
    addEvent: addEventToModule,
    removeEvent: removeEventFromModule,
} as const;
