import { drizzleOperationsBuilder } from "@/api-server/curriculum/db-base";
import { curriculumWeeks } from "@/api-server/curriculum/schema";
import { CreateCurriculumWeekPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    CurriculumWeek,
    typeof curriculumWeeks,
    CreateCurriculumWeekPayload
>({
    table: curriculumWeeks,
    typeName: 'שבוע',
    idPreffix: 'w',
});

export const DbWeek = {
    ...basicOperations,
} as const;
