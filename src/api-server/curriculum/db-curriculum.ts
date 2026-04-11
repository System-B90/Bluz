import { postgresDb } from "@/api-server/curriculum";
import { drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base"; // Your new Drizzle builder
import { curriculums, curriculumSyllabuses } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateCurriculumPayload } from "@/api-shared/types/gant/create-payloads";
import { Curriculum, CurriculumId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { eq, and } from "drizzle-orm";

const basicOperations = drizzleOperationsBuilder<
    Curriculum,
    typeof curriculums,
    CreateCurriculumPayload
>({
    table: curriculums,
    typeName: 'גאנט',
    junction: {
        table: curriculumSyllabuses,
        localKey: curriculumSyllabuses.curriculumId,
        relationKey: curriculumSyllabuses.syllabusId,
        apiKey: "s"
    },
});

async function getFullCurriculum(id: CurriculumId): Promise<Curriculum>
{
    const result = await postgresDb.query.curriculums.findFirst({
        where: eq(curriculums.id, id),
        with: {
            // Nested Syllabuses
            cS: {
                with: {
                    syllabus: {
                        with: {
                            // Nested Modules
                            sM: {
                                with: {
                                    module: {
                                        with: {
                                            // Nested Events
                                            mE: {
                                                with: {
                                                    event: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!result)
    {
        throw new ClientApiError(`גאנט עם מזהה ${id} לא נמצא`);
    }

    // Note: You may need a mapper here depending on if your frontend 
    // expects the raw Drizzle Relational structure or a flattened array.
    console.log('Returning: ', result);
    return result as unknown as Curriculum;
}
basicOperations.getItem = getFullCurriculum;
async function addSyllabusToCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<void>
{
    try
    {
        // In SQL, we don't push to an array. We insert a row mapping the two IDs together.
        await postgresDb.insert(curriculumSyllabuses).values({
            curriculumId: curriculumId,
            syllabusId: syllabusId,
        });
    } catch (error: any)
    {
        // Postgres will throw specific errors for constraint violations.
        // e.g., Code '23505' is a Unique Violation (the syllabus is already linked to this curriculum).
        if (error.code === UNIQUE_VIOLATION)
        {
            // Depending on your UI, you might just want to return void here instead of throwing
            throw new ClientApiError(`הסילבוס כבר משויך לגאנט זה`);
        }
        // Code '23503' is a Foreign Key Violation (the curriculum or syllabus doesn't exist).
        if (error.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`גאנט או סילבוס לא קיימים במערכת`);
        }

        throw new ClientApiError(`Failed to add ${syllabusId} to ${curriculumId}`);
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

export const DbCurriculum = {
    ...basicOperations,
    addSyllabus: addSyllabusToCurriculum,
    removeSyllabus: removeSyllabusFromCurriculum,
} as const;
