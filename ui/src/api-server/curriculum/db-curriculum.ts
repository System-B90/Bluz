import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder } from "@/api-server/curriculum/db-base"; // Your new Drizzle builder
import { curriculums, curriculumSyllabuses } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateCurriculumPayload } from "@/api-shared/types/gant/create-payloads";
import { Curriculum, CurriculumId } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    Curriculum,
    typeof curriculums,
    CreateCurriculumPayload
>({
    table: curriculums,
    typeName: 'גאנט',
    idPreffix: 'c',
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
            cS: {
                with: {
                    syllabus: {
                        with: {
                            sM: {
                                with: {
                                    module: {
                                        with: {
                                            mE: {
                                                with: {
                                                    event: { // moduleEvents table
                                                        with: {
                                                            cEC: { // curriculumEventConfigurations
                                                                where: (c, { eq }) => eq(c.curriculumId, id)
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
                }
            }
        }
    });

    if (!result)
    {
        throw new ClientApiError(`גאנט עם מזהה ${id} לא נמצא`);
    }

    return result as unknown as Curriculum & BaseDbDocument;
}

basicOperations.getItem = getFullCurriculum;
export const DbCurriculum = {
    ...basicOperations,
} as const;
