import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import { ganttCurriculum2SyllabusesSchema } from "@/api-server/gantt/schema";
import { ganttCurriculumsSchema } from "@/api-server/gantt/schema/curriculums";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import
{
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";

const basicOperations = drizzleOperationsBuilder<
  GanttCurriculum,
  typeof ganttCurriculumsSchema,
  CreateGanttCurriculumPayload
>({
    table: ganttCurriculumsSchema,
    typeName: "גאנט",
    idPrefix: "c",
    junction: {
        table: ganttCurriculum2SyllabusesSchema,
        localKey: ganttCurriculum2SyllabusesSchema.curriculumId,
        relationKey: ganttCurriculum2SyllabusesSchema.syllabusId,
        apiKey: "s",
    },
});

async function getFullCurriculum(
    id: GanttCurriculumId,
): Promise<ApiCurriculum> {
    const result = await postgresDb.query.ganttCurriculumsSchema.findFirst({
        where: eq(ganttCurriculumsSchema.id, id),
        with: {
            c2s: {
                with: {
                    syllabus: {
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
                                                                where: (c, { eq }) => eq(c.curriculumId, id),
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            c2w: {
                with: {
                    week: {
                        with: {
                            w2d: {
                                with: {
                                    day: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`גאנט עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}

export const DbCurriculum = {
    ...basicOperations,
    getItem: getFullCurriculum,
} as const;
