
import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import { ganttCurriculum2WeeksSchema, ganttWeek2DaysSchema } from "@/api-server/gantt/schema";
import { ganttWeeksSchema } from "@/api-server/gantt/schema/weeks";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculumWeek } from "@/api-shared/types/gant/api-layer";
import { CreateCurriculumWeekPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumWeek, CurriculumWeekId } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    CurriculumWeek,
    typeof ganttWeeksSchema,
    CreateCurriculumWeekPayload
>({
    table: ganttWeeksSchema,
    typeName: 'שבוע',
    idPreffix: 'w',
junction: {
        table: ganttWeek2DaysSchema,
        localKey: ganttWeek2DaysSchema.weekId,
        relationKey: ganttWeek2DaysSchema.dayId,
        apiKey: "days"
    },
    parentJunction: {
        table: ganttCurriculum2WeeksSchema,
        parentKey: 'curriculumId',
        selfKey: 'weekId',
    },
});

async function getFullWeek(id: CurriculumWeekId): Promise<ApiCurriculumWeek>
{
    const result = await postgresDb.query.ganttWeeksSchema.findFirst({
        where: eq(ganttWeeksSchema.id, id),
        with: {
            w2d: {
                with: {
                    day: true
                }
            }
        }
    });

    if (!result)
    {
        throw new ClientApiError(`שבוע עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}

export const DbWeek = {
    getItem: getFullWeek,
    ...basicOperations,
} as const;
