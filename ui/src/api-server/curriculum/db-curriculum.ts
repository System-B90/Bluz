import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder } from "@/api-server/curriculum/db-base"; // Your new Drizzle builder
import { curriculums, curriculumSyllabuses } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateCurriculumPayload } from "@/api-shared/types/gant/create-payloads";
import { Curriculum, CurriculumId } from "@/api-shared/types/gant/curriculum";
import { eq } from "drizzle-orm";

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

async function getFullCurriculum(id: CurriculumId): Promise<Curriculum & BaseDbDocument>
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
    return result as unknown as Curriculum & BaseDbDocument;
}
basicOperations.getItem = getFullCurriculum;
export const DbCurriculum = {
    ...basicOperations,
} as const;
