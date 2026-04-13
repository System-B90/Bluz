import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { curriculumSyllabuses, syllabuses, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateSyllabusPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumId, Syllabus, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { and, eq } from "drizzle-orm";

const basicOperations = drizzleOperationsBuilder<
    Syllabus,
    typeof syllabuses,
    CreateSyllabusPayload
>({
    table: syllabuses,
    typeName: 'סילבוס',
    idPreffix: 's',
    junction: {
        table: syllabusModules,
        localKey: syllabusModules.syllabusId,
        relationKey: syllabusModules.moduleId,
        apiKey: "modules"
    },
    parentJunction: {
        type: 'curriculum',
    },
});

async function addSyllabusToCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<Syllabus & BaseDbDocument>
{
    try
    {
        await postgresDb.insert(curriculumSyllabuses).values({
            curriculumId: curriculumId,
            syllabusId: syllabusId,
        });

        return await basicOperations.getItem(syllabusId);
    } catch (error: any)
    {
        const cause = error.cause as { name: string; severity: string; code: string; detail: string; };

        if (cause?.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`הסילבוס כבר משויך לגאנט זה`);
        }

        if (cause?.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`גאנט או סילבוס לא קיימים במערכת`);
        }

        throw new ClientApiError(`Failed to add ${syllabusId} to ${curriculumId}. Error[${cause?.code}]: ${cause?.detail}`);
    }
}

async function removeSyllabusFromCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<void>
{
    // We delete the specific mapping row from the junction table
    const result = await postgresDb.delete(curriculumSyllabuses)
        .where(
            and(
                eq(curriculumSyllabuses.curriculumId, curriculumId),
                eq(curriculumSyllabuses.syllabusId, syllabusId)
            )
        )
        .returning({ deletedCurriculumId: curriculumSyllabuses.curriculumId });

    // If .returning() is empty, the link didn't exist to begin with
    if (result.length === 0)
    {
        throw new ClientApiError(`No mapping found for syllabus ${syllabusId} in curriculum ${curriculumId}`);
    }
}


export const DbSyllabus = {
    ...basicOperations,
    linkItem: addSyllabusToCurriculum,
    unlinkItem: removeSyllabusFromCurriculum,
} as const;
