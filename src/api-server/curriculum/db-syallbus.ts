import { curriculumDbOperationsBuilder } from "@/api-server/curriculum/db-base";
import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";

const basicOperations = curriculumDbOperationsBuilder({ dbCollection: databaseController.syllabuses, typeName: 'סילבוס' });

async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const updateResult = await databaseController.syllabuses.updateOne({ id: syllabusId }, { '$addToSet': { 'modules': moduleId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No syllabus by id ${syllabusId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to add ${moduleId} to ${syllabusId}`);
    }
}

async function removeModuleRemoveSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const updateResult = await databaseController.syllabuses.updateOne({ id: syllabusId }, { '$pull': { 'modules': moduleId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No syllabus by id ${syllabusId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to remove ${moduleId} from ${syllabusId}`);
    }
}

export const DbSyllabus = {
    ...basicOperations,
    addModule: addModuleToSyllabus,
    removeModule: removeModuleRemoveSyllabus,
} as const;
