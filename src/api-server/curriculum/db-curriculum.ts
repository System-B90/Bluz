import { curriculumDbOperationsBuilder } from "@/api-server/curriculum/db-base";
import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { CurriculumId, SyllabusId } from "@/api-shared/types/gant/curriculum";

const basicOperations = curriculumDbOperationsBuilder({ dbCollection: databaseController.curriculums, typeName: 'גאנט' });

async function addSyllabusToCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<void>
{
    const updateResult = await databaseController.curriculums.updateOne({ id: curriculumId }, { '$addToSet': { 'syllabuses': syllabusId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No curriculum by id ${curriculumId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to add ${syllabusId} to ${curriculumId}`);
    }
}

async function removeSyllabusFromCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<void>
{
    const updateResult = await databaseController.curriculums.updateOne({ id: curriculumId }, { '$pull': { 'syllabuses': syllabusId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No curriculum by id ${curriculumId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to remove ${syllabusId} from ${curriculumId}`);
    }
}

export const DbCurriculum = {
    ...basicOperations,
    addSyllabus: addSyllabusToCurriculum,
    removeSyllabus: removeSyllabusFromCurriculum,
} as const;
