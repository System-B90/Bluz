import { drizzleOperationsBuilder } from "@/api-server/curriculum/db-base";
import { curriculumDays } from "@/api-server/curriculum/schema";
import { CreateCurriculumDayPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumDay, DAY_NAME_DISPLAY, DayName } from "@/api-shared/types/gant/curriculum";

function generateDayTitle(day: { day: DayName }): string {
    return DAY_NAME_DISPLAY[day.day] ?? `יום ${day.day}`;
}

function transformDayFromDb(dbRow: any): CurriculumDay {
    return {
        id: dbRow.id,
        title: generateDayTitle(dbRow),
        day: dbRow.day,
        totalWorkingHours: dbRow.totalWorkingHours,
        comment: dbRow.comment,
    };
}

const basicOperations = drizzleOperationsBuilder<
    CurriculumDay,
    typeof curriculumDays,
    CreateCurriculumDayPayload
>({
    table: curriculumDays,
    typeName: 'יום',
    idPreffix: 'd',
});

export const DbDay = {
    listItems: basicOperations.listItems,
    getMultipleItems: async (ids: string[]) => {
        const items = await basicOperations.getMultipleItems(ids);
        return items.map(transformDayFromDb);
    },
    getItem: async (id: string) => {
        const item = await basicOperations.getItem(id);
        return transformDayFromDb(item) as any;
    },
    createNewItem: async (payload: CreateCurriculumDayPayload) => {
        const item = await basicOperations.createNewItem(payload);
        return transformDayFromDb(item);
    },
    updateItem: async (id: string, updates: Partial<CurriculumDay>) => {
        const item = await basicOperations.updateItem(id, updates);
        return transformDayFromDb(item);
    },
    deleteItem: basicOperations.deleteItem,
} as const;
