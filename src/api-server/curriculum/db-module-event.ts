import { drizzleOperationsBuilder } from "@/api-server/curriculum/db-base";
import { moduleEvents } from "@/api-server/curriculum/schema";
import { CreateModuleEventPayload } from "@/api-shared/types/gant/create-payloads";
import { ModuleEvent } from "@/api-shared/types/gant/curriculum";

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
});

export const DbModuleEvent = {
    ...basicOperations,
} as const;
