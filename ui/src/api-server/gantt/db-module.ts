import { and, asc, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { asWireShape, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, postgresErrorCode, UNIQUE_VIOLATION } from "@/api-server/gantt/db-base";
import {
    ganttModule2EventsSchema,
    ganttModulesSchema,
    ganttSyllabus2ModulesSchema,
} from "@/api-server/gantt/schema";
import { ganttCurriculumEventConfigurationsSchema } from "@/api-server/gantt/schema/mappings";
import { ClientApiError } from "@/api-shared/errors";
import {
    AllocateTimeToEventCallback,
    allocateTimeToModule,
    AllocateTimeToModuleCallbackModuleEvents,
} from "@/api-shared/gantt/allocate-time";
import { ApiModule } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
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
    },
});

async function getFullModule(id: GanttModuleId): Promise<ApiModule> {
    const result = await postgresDb.query.ganttModulesSchema.findFirst({
        where: eq(ganttModulesSchema.id, id),
        with: {
            m2e: {
                orderBy: [asc(ganttModule2EventsSchema.sortOrder)],
                with: {
                    event: {
                        with: {
                            cEC: true,
                        },
                    },
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

async function setAllocatedTime(
    moduleId: GanttModuleId,
    curriculumId: GanttCurriculumId,
    duration: number,
): Promise<void> {
    // One module's allocation is one decision spread over an upsert per event.
    // Untransacted, a failure partway left the module's events holding a
    // half-applied split that adds up to the wrong total (#538 item 3). The
    // read joins the transaction too, so the split is computed from the rows
    // it is about to write.
    await postgresDb.transaction(async (tx) => {
        const moduleToEventsData =
        await tx.query.ganttModule2EventsSchema.findMany({
            where: eq(ganttModule2EventsSchema.moduleId, moduleId),
            with: {
                event: { columns: { id: true, minimumDuration: true } },
            },
            orderBy: [asc(ganttModule2EventsSchema.eventId)],
        });

        const callback: AllocateTimeToEventCallback = async ({
            eventId,
            curriculumId,
            duration,
        }) => {
            await tx
                .insert(ganttCurriculumEventConfigurationsSchema)
                .values({
                    curriculumId,
                    eventId: eventId,
                    allocatedDuration: duration,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [
                        ganttCurriculumEventConfigurationsSchema.curriculumId,
                        ganttCurriculumEventConfigurationsSchema.eventId,
                    ],
                    set: {
                        allocatedDuration: duration,
                        updatedAt: new Date(),
                    },
                });
        };

        const moduleEvents = moduleToEventsData.reduce(
            (prev, curr) => ({ ...prev, [curr.event.id]: curr.event }),
        {} as AllocateTimeToModuleCallbackModuleEvents,
        );

        await allocateTimeToModule({
            module: {
                id: moduleId,
                events: moduleToEventsData.map((e) => e.eventId),
            },
            totalDuration: duration,
            curriculumId,
            allocateToEventCallback: callback,
            moduleEvents,
        });
    });
}

async function getAllocatedTime(
    moduleId: GanttModuleId,
    curriculumId: GanttCurriculumId,
): Promise<number> {
    const moduleData = await postgresDb.query.ganttModulesSchema.findFirst({
        where: eq(ganttModulesSchema.id, moduleId),
        with: {
            m2e: {
                with: {
                    event: {
                        with: {
                            cEC: {
                                where: eq(
                                    ganttCurriculumEventConfigurationsSchema.curriculumId,
                                    curriculumId,
                                ),
                            },
                        },
                    },
                },
            },
        },
    });

    if (!moduleData) {
        return 0;
    }

    const total = moduleData.m2e.reduce((acc, link) => {
        const config = link.event.cEC[0];
        const duration = config?.allocatedDuration ?? 0;

        return acc + duration;
    }, 0);

    return total;
}

async function reorderEvents(
    moduleId: GanttModuleId,
    eventIds: Array<GanttEventId>,
): Promise<void> {
    await postgresDb.transaction(async (tx) => {
        for (let i = 0; i < eventIds.length; i++) {
            await tx
                .update(ganttModule2EventsSchema)
                .set({ sortOrder: i })
                .where(
                    and(
                        eq(ganttModule2EventsSchema.moduleId, moduleId),
                        eq(ganttModule2EventsSchema.eventId, eventIds[i]),
                    ),
                );
        }
    });
}

export const DbModule = {
    getItem: getFullModule,
    ...basicOperations,
    linkItem: addModuleToSyllabus,
    unlinkItem: removeModuleFromSyllabus,
    setAllocatedTime,
    getAllocatedTime,
    reorderEvents,
} as const;
