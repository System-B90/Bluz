import { and, asc, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { curriculumEventConfigurations, modules, moduleToEvents, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { AllocateTimeToEventCallback, allocateTimeToModule, AllocateTimeToModuleCallbackModuleEvents } from "@/api-shared/gantt/allocate-time";
import { CreateModulePayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumId, Module, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    Module,
    typeof modules,
    CreateModulePayload
>({
    table: modules,
    typeName: 'מערך',
    idPreffix: 'm',
    junction: {
        table: moduleToEvents,
        localKey: moduleToEvents.moduleId,
        relationKey: moduleToEvents.eventId,
        apiKey: "events"
    },
    parentJunction: {
        type: 'syllabus'
    },
});

async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<Module & BaseDbDocument>
{
    try
    {
        await postgresDb.insert(syllabusModules).values({
            syllabusId: syllabusId,
            moduleId: moduleId,
        });
        return await basicOperations.getItem(moduleId);
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
    const result = await postgresDb.delete(syllabusModules)
        .where(
            and(
                eq(syllabusModules.syllabusId, syllabusId),
                eq(syllabusModules.moduleId, moduleId)
            )
        )
        .returning({ deletedSyllabusId: syllabusModules.syllabusId });

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
    const moduleToEventsData = await postgresDb.query.moduleToEvents.findMany({
        where: eq(moduleToEvents.moduleId, moduleId),
        with: {
            event: { columns: { id: true, minimumDuration: true } }
        },
        orderBy: [ asc(moduleToEvents.eventId) ],
    });

    const callback: AllocateTimeToEventCallback = async ({ eventId, curriculumId, duration }) =>
    {
        await postgresDb
            .insert(curriculumEventConfigurations)
            .values({
                curriculumId,
                eventId: eventId,
                allocatedDuration: duration,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [
                    curriculumEventConfigurations.curriculumId,
                    curriculumEventConfigurations.eventId
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
    const moduleData = await postgresDb.query.modules.findFirst({
        where: eq(modules.id, moduleId),
        with: {
            mE: {
                with: {
                    event: {
                        with: {
                            cEC: {
                                where: eq(curriculumEventConfigurations.curriculumId, curriculumId)
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

    const total = moduleData.mE.reduce((acc, link) =>
    {
        const config = link.event.cEC[ 0 ];
        const duration = config?.allocatedDuration ?? 0;

        return acc + duration;
    }, 0);

    return total;
}

export const DbModule = {
    ...basicOperations,
    linkItem: addModuleToSyllabus,
    unlinkItem: removeModuleFromSyllabus,
    setAllocatedTime,
    getAllocatedTime,
} as const;
