import { and, eq, inArray, sql } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    asWireShape,
    drizzleOperationsBuilder,
    FOREIGN_KEY_VIOLATION,
    postgresErrorCode,
    UNIQUE_VIOLATION,
} from "@/api-server/gantt/db-base";
import {
    ganttModule2EventsSchema,
    ganttModulesSchema,
    ganttSyllabus2ModulesSchema,
} from "@/api-server/gantt/schema";
import { M2E_ORDER, nextModuleSortOrder } from "@/api-server/gantt/sort-order";
import { ClientApiError } from "@/api-shared/errors";
import { ApiModule } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttEventId,
    GanttModule,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

const basicOperations = drizzleOperationsBuilder<
    GanttModule,
    typeof ganttModulesSchema,
    CreateGanttModulePayload
>({
    table: ganttModulesSchema,
    typeName: "מערך",
    idPrefix: "m",
    junction: {
        table: ganttModule2EventsSchema,
        localKey: ganttModule2EventsSchema.moduleId,
        relationKey: ganttModule2EventsSchema.eventId,
        apiKey: "events",
    },
    parentJunction: {
        table: ganttSyllabus2ModulesSchema,
        parentKey: "syllabusId",
        selfKey: "moduleId",
        cardinality: "one",
        nextSortOrder: (id) => nextModuleSortOrder(id as GanttSyllabusId),
    },
});

async function getFullModule(id: GanttModuleId): Promise<ApiModule> {
    const result = await postgresDb.query.ganttModulesSchema.findFirst({
        where: eq(ganttModulesSchema.id, id),
        with: {
            m2e: {
                orderBy: M2E_ORDER,
                with: {
                    event: true,
                },
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`מערך עם מזהה ${id} לא נמצא`);
    }

    await basicOperations.attachParentIds([result]);
    return asWireShape<ApiModule>(result);
}

async function addModuleToSyllabus(
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
): Promise<ApiModule> {
    try {
        await postgresDb.insert(ganttSyllabus2ModulesSchema).values({
            syllabusId: syllabusId,
            moduleId: moduleId,
            sortOrder: nextModuleSortOrder(syllabusId),
        });
        return await getFullModule(moduleId);
    } catch (error: unknown) {
        const code = postgresErrorCode(error);

        // Unique Violation: Module already linked
        if (code === UNIQUE_VIOLATION) {
            throw new ClientApiError(`המערך כבר משויך לסילבוס זה`);
        }
        // Foreign Key Violation: Syllabus or Module missing
        if (code === FOREIGN_KEY_VIOLATION) {
            throw new ClientApiError(`סילבוס או מערך לא קיימים במערכת`);
        }

        throw new ClientApiError(
            `Failed to add module ${moduleId} to syllabus ${syllabusId}`,
        );
    }
}

async function removeModuleFromSyllabus(
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
): Promise<void> {
    const result = await postgresDb
        .delete(ganttSyllabus2ModulesSchema)
        .where(
            and(
                eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId),
                eq(ganttSyllabus2ModulesSchema.moduleId, moduleId),
            ),
        )
        .returning({
            deletedSyllabusId: ganttSyllabus2ModulesSchema.syllabusId,
        });

    if (result.length === 0) {
        throw new ClientApiError(
            `No mapping found for module ${moduleId} in syllabus ${syllabusId}`,
        );
    }
}

async function reorderEvents(
    moduleId: GanttModuleId,
    eventIds: Array<GanttEventId>,
): Promise<void> {
    if (eventIds.length === 0) return;

    // One statement with a CASE ladder instead of an awaited UPDATE per event
    // - reordering a large module was N sequential round trips (#538 item 9).
    const order = sql.join(
        eventIds.map(
            (eventId, index) =>
                sql`when ${ganttModule2EventsSchema.eventId} = ${eventId} then ${index}::integer`,
        ),
        sql` `,
    );

    await postgresDb
        .update(ganttModule2EventsSchema)
        .set({ sortOrder: sql`case ${order} end` })
        .where(
            and(
                eq(ganttModule2EventsSchema.moduleId, moduleId),
                inArray(ganttModule2EventsSchema.eventId, eventIds),
            ),
        );
}

export const DbModule = {
    getItem: getFullModule,
    ...basicOperations,
    linkItem: addModuleToSyllabus,
    unlinkItem: removeModuleFromSyllabus,
    reorderEvents,
} as const;
