import { curriculumDbOperationsBuilder } from "@/api-server/curriculum/db-base";
import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { ModuleEventId, ModuleId } from "@/api-shared/types/gant/curriculum";

const basicOperations = curriculumDbOperationsBuilder({ dbCollection: databaseController.modules, typeName: 'מודול' });

async function addEventToModule(moduleId: ModuleId, moduleEventId: ModuleEventId): Promise<void>
{
    const updateResult = await databaseController.modules.updateOne({ id: moduleId }, { '$addToSet': { 'events': moduleEventId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No module by id ${moduleId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to add ${moduleEventId} to ${moduleId}`);
    }
}

async function removeEventFromModule(moduleId: ModuleId, moduleEventId: ModuleEventId): Promise<void>
{
    const updateResult = await databaseController.modules.updateOne({ id: moduleId }, { '$pull': { events: moduleEventId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No module by id ${moduleId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to remove ${moduleEventId} from ${moduleId}`);
    }
}

export const DbModule = {
    ...basicOperations,
    addEvent: addEventToModule,
    removeEvent: removeEventFromModule,
} as const;
