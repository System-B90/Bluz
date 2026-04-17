import { and, asc, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/gantt/db-base";
import { ganttModule2EventsSchema, ganttModulesSchema, ganttSyllabus2ModulesSchema } from "@/api-server/gantt/schema";
import { ganttCurriculumEventConfigurationsSchema } from "@/api-server/gantt/schema/mappings";
import { ClientApiError } from "@/api-shared/errors";
import { AllocateTimeToEventCallback, allocateTimeToModule, AllocateTimeToModuleCallbackModuleEvents } from "@/api-shared/gantt/allocate-time";
import { ApiModule } from "@/api-shared/types/gant/api-layer";
import { CreateModulePayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumId, Module, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    Module,
    typeof ganttModulesSchema,
    CreateModulePayload
>({
    table: ganttModulesSchema,
    typeName: 'מערך',
    idPreffix: 'm',
    junction: {
        table: ganttModule2EventsSchema,
        localKey: ganttModule2EventsSchema.moduleId,
        relationKey: ganttModule2EventsSchema.eventId,
        apiKey: "events"
    },
    parentJunction: {
        table: ganttSyllabus2ModulesSchema,
        parentKey: 'syllabusId',
        selfKey: 'moduleId',
    },
});

async function getFullModule(id: ModuleId): Promise<ApiModule>
{
    const result = await postgresDb.query.ganttModulesSchema.findFirst({
        where: eq(ganttModulesSchema.id, id),
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
    });

    if (!result)
    {
        throw new ClientApiError(`מערך עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}

async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<ApiModule>
{
    try
    {
        await postgresDb.insert(ganttSyllabus2ModulesSchema).values({
            syllabusId: syllabusId,
            moduleId: moduleId,
        });
        return await getFullModule(moduleId);
    } catch (error: any)
    {
        const cause = error.cause as { name: string; severity: string; code: string; detail: string; };

        // Unique Violation: Module already linked
        if (cause?.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`המערך כבר משויך לסילבוס זה`);
        }
        // Foreign Key Violation: Syllabus or Module missing
        if (cause?.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`סילבוס או מערך לא קיימים במערכת`);
        }

        throw new ClientApiError(`Failed to add module ${moduleId} to syllabus ${syllabusId}`);
    }
}

async function removeModuleFromSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const result = await postgresDb.delete(ganttSyllabus2ModulesSchema)
        .where(
            and(
                eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId),
                eq(ganttSyllabus2ModulesSchema.moduleId, moduleId)
            )
        )
        .returning({ deletedSyllabusId: ganttSyllabus2ModulesSchema.syllabusId });

    if (result.length === 0)
    {
        throw new ClientApiError(`No mapping found for module ${moduleId} in syllabus ${syllabusId}`);
    }
}

async function setAllocatedTime(
    moduleId: ModuleId,
    curriculumId: CurriculumId,
    duration: number
): Promise<void>
{
    const moduleToEventsData = await postgresDb.query.ganttModule2EventsSchema.findMany({
        where: eq(ganttModule2EventsSchema.moduleId, moduleId),
        with: {
            event: { columns: { id: true, minimumDuration: true } }
        },
        orderBy: [ asc(ganttModule2EventsSchema.eventId) ],
    });

    const callback: AllocateTimeToEventCallback = async ({ eventId, curriculumId, duration }) =>
    {
        await postgresDb
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
                    ganttCurriculumEventConfigurationsSchema.eventId
                ],
                set: {
                    allocatedDuration: duration,
                    updatedAt: new Date(),
                },
            });
    };

    const moduleEvents = moduleToEventsData.reduce((prev, curr) => ({ ...prev, [ curr.event.id ]: curr.event }), {} as AllocateTimeToModuleCallbackModuleEvents);

    await allocateTimeToModule({
        module: {
            id: moduleId,
            events: moduleToEventsData.map(e => e.eventId)
        },
        totalDuration: duration,
        curriculumId,
        allocateToEventCallback: callback,
        moduleEvents,
    });
}

async function getAllocatedTime(
    moduleId: ModuleId,
    curriculumId: CurriculumId
): Promise<number>
{
    const moduleData = await postgresDb.query.ganttModulesSchema.findFirst({
        where: eq(ganttModulesSchema.id, moduleId),
        with: {
            m2e: {
                with: {
                    event: {
                        with: {
                            cEC: {
                                where: eq(ganttCurriculumEventConfigurationsSchema.curriculumId, curriculumId)
                            }
                        }
                    }
                }
            }
        }
    });

    if (!moduleData)
    {
        return 0;
    }

    const total = moduleData.m2e.reduce((acc, link) =>
    {
        const config = link.event.cEC[ 0 ];
        const duration = config?.allocatedDuration ?? 0;

        return acc + duration;
    }, 0);

    return total;
}

export const DbModule = {
    getItem: getFullModule,
    ...basicOperations,
    linkItem: addModuleToSyllabus,
    unlinkItem: removeModuleFromSyllabus,
    setAllocatedTime,
    getAllocatedTime,
} as const;
