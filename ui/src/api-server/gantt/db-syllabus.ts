import { and, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/gantt/db-base";
import { ganttCurriculum2SyllabusesSchema, ganttSyllabus2ModulesSchema, ganttSyllabusesSchema } from "@/api-server/gantt/schema";
import { ClientApiError } from "@/api-shared/errors";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttCurriculumId, GanttSyllabus, GanttSyllabusId } from "@/api-shared/types/gantt/curriculum";

const basicOperations = drizzleOperationsBuilder<
    GanttSyllabus,
    typeof ganttSyllabusesSchema,
    CreateGanttSyllabusPayload
>({
    table: ganttSyllabusesSchema,
    typeName: 'סילבוס',
    idPreffix: 's',
    junction: {
        table: ganttSyllabus2ModulesSchema,
        localKey: ganttSyllabus2ModulesSchema.syllabusId,
        relationKey: ganttSyllabus2ModulesSchema.moduleId,
        apiKey: "modules"
    },
    parentJunction: {
        table: ganttCurriculum2SyllabusesSchema,
        parentKey: 'curriculumId',
        selfKey: 'syllabusId',
    },
});

async function getFullSyllabus(id: GanttSyllabusId): Promise<ApiSyllabus>
{
    const result = await postgresDb.query.ganttSyllabusesSchema.findFirst({
        where: eq(ganttSyllabusesSchema.id, id),
        with: {
            s2m: {
                with: {
                    module: {
                        with: {
                            m2e: {
                                with: {
                                    event: {
                                        with: {
                                            cEC: {
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
    });

    if (!result)
    {
        throw new ClientApiError(`סילבוס עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}

async function addSyllabusToCurriculum(curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId): Promise<ApiSyllabus>
{
    try
    {
        await postgresDb.insert(ganttCurriculum2SyllabusesSchema).values({
            curriculumId: curriculumId,
            syllabusId: syllabusId,
        });

        return await getFullSyllabus(syllabusId);
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

async function removeSyllabusFromCurriculum(curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId): Promise<void>
{
    // We delete the specific mapping row from the junction table
    const result = await postgresDb.delete(ganttCurriculum2SyllabusesSchema)
        .where(
            and(
                eq(ganttCurriculum2SyllabusesSchema.curriculumId, curriculumId),
                eq(ganttCurriculum2SyllabusesSchema.syllabusId, syllabusId)
            )
        )
        .returning({ deletedCurriculumId: ganttCurriculum2SyllabusesSchema.curriculumId });

    // If .returning() is empty, the link didn't exist to begin with
    if (result.length === 0)
    {
        throw new ClientApiError(`No mapping found for syllabus ${syllabusId} in curriculum ${curriculumId}`);
    }
}

export const DbSyllabus = {
    getItem: getFullSyllabus,
    ...basicOperations,
    linkItem: addSyllabusToCurriculum,
    unlinkItem: removeSyllabusFromCurriculum,
} as const;
