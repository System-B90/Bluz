import { and, arrayOverlaps, asc, eq, inArray } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    drizzleOperationsBuilder,
    FOREIGN_KEY_VIOLATION,
    postgresErrorCode,
    UNIQUE_VIOLATION,
} from "@/api-server/gantt/db-base";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
    ganttSyllabusesSchema,
} from "@/api-server/gantt/schema";
import { ClientApiError } from "@/api-shared/errors";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

const basicOperations = drizzleOperationsBuilder<
    GanttSyllabus,
    typeof ganttSyllabusesSchema,
    CreateGanttSyllabusPayload
>({
    table: ganttSyllabusesSchema,
    typeName: "סילבוס",
    idPrefix: "s",
    junction: {
        table: ganttSyllabus2ModulesSchema,
        localKey: ganttSyllabus2ModulesSchema.syllabusId,
        relationKey: ganttSyllabus2ModulesSchema.moduleId,
        apiKey: "modules",
    },
    parentJunction: {
        table: ganttCurriculum2SyllabusesSchema,
        // A syllabus is shareable across curriculums — `addSyllabusToCurriculum`
        // just inserts another c2s row — so this is the one parent link that
        // must be surfaced as a list. See #310.
        parentKey: "curriculumId",
        outputKey: "curriculumIds",
        selfKey: "syllabusId",
        cardinality: "many",
    },
});

async function getFullSyllabus(id: GanttSyllabusId): Promise<ApiSyllabus> {
    const result = await postgresDb.query.ganttSyllabusesSchema.findFirst({
        where: eq(ganttSyllabusesSchema.id, id),
        with: {
            s2m: {
                orderBy: [asc(ganttSyllabus2ModulesSchema.sortOrder)],
                with: {
                    module: {
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
                    },
                },
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`סילבוס עם מזהה ${id} לא נמצא`);
    }

    await basicOperations.attachParentIds([result]);
    return result as unknown as ApiSyllabus;
}

async function addSyllabusToCurriculum(
    curriculumId: GanttCurriculumId,
    syllabusId: GanttSyllabusId,
): Promise<ApiSyllabus> {
    try {
        await postgresDb.insert(ganttCurriculum2SyllabusesSchema).values({
            curriculumId: curriculumId,
            syllabusId: syllabusId,
        });

        return await getFullSyllabus(syllabusId);
    } catch (error: unknown) {
        const code = postgresErrorCode(error);

        if (code === UNIQUE_VIOLATION) {
            throw new ClientApiError(`הסילבוס כבר משויך לגאנט זה`);
        }

        if (code === FOREIGN_KEY_VIOLATION) {
            throw new ClientApiError(`גאנט או סילבוס לא קיימים במערכת`);
        }

        throw new ClientApiError(
            `Failed to add syllabus ${syllabusId} to curriculum ${curriculumId}`,
        );
    }
}

async function removeSyllabusFromCurriculum(
    curriculumId: GanttCurriculumId,
    syllabusId: GanttSyllabusId,
): Promise<void> {
    // We delete the specific mapping row from the junction table
    const result = await postgresDb
        .delete(ganttCurriculum2SyllabusesSchema)
        .where(
            and(
                eq(ganttCurriculum2SyllabusesSchema.curriculumId, curriculumId),
                eq(ganttCurriculum2SyllabusesSchema.syllabusId, syllabusId),
            ),
        )
        .returning({
            deletedCurriculumId: ganttCurriculum2SyllabusesSchema.curriculumId,
        });

    // If .returning() is empty, the link didn't exist to begin with
    if (result.length === 0) {
        throw new ClientApiError(
            `No mapping found for syllabus ${syllabusId} in curriculum ${curriculumId}`,
        );
    }
}

async function reorderModules(
    syllabusId: GanttSyllabusId,
    moduleIds: Array<GanttModuleId>,
): Promise<void> {
    await postgresDb.transaction(async (tx) => {
        for (let i = 0; i < moduleIds.length; i++) {
            await tx
                .update(ganttSyllabus2ModulesSchema)
                .set({ sortOrder: i })
                .where(
                    and(
                        eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId),
                        eq(ganttSyllabus2ModulesSchema.moduleId, moduleIds[i]),
                    ),
                );
        }
    });
}

/**
 * Events under `syllabusId` that are tagged with any of `shuffleNames`.
 *
 * Walks s2m → m2e → e so the check stays scoped to the syllabus that owns the
 * shuffle names; an event reached through another syllabus keeps its own tags.
 */
async function findEventsUsingShuffles(
    syllabusId: GanttSyllabusId,
    shuffleNames: Array<string>,
): Promise<Array<{ id: string; title: string }>> {
    if (shuffleNames.length === 0) return [];

    const moduleRows = await postgresDb
        .select({ moduleId: ganttSyllabus2ModulesSchema.moduleId })
        .from(ganttSyllabus2ModulesSchema)
        .where(eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId));

    const moduleIds = moduleRows.map((row) => row.moduleId);
    if (moduleIds.length === 0) return [];

    const rows = await postgresDb
        .selectDistinct({
            id: ganttEventsSchema.id,
            title: ganttEventsSchema.title,
        })
        .from(ganttEventsSchema)
        .innerJoin(
            ganttModule2EventsSchema,
            eq(ganttModule2EventsSchema.eventId, ganttEventsSchema.id),
        )
        .where(
            and(
                inArray(ganttModule2EventsSchema.moduleId, moduleIds),
                arrayOverlaps(ganttEventsSchema.shuffles, shuffleNames),
            ),
        );

    return rows;
}

/**
 * Blocks removing a shuffle name that events still reference (#485).
 *
 * Without this the event keeps a dangling name and the UI only offers to clear
 * it once the user retypes the deleted shuffle on the syllabus.
 */
async function updateSyllabus(
    id: GanttSyllabusId,
    updateData: Partial<GanttSyllabus>,
): Promise<GanttSyllabus> {
    if (updateData.shuffles !== undefined) {
        const current = await postgresDb.query.ganttSyllabusesSchema.findFirst({
            where: eq(ganttSyllabusesSchema.id, id),
            columns: { shuffles: true },
        });

        if (!current) {
            throw new ClientApiError(`סילבוס עם מזהה ${id} לא נמצא לעדכון`);
        }

        const next = new Set(updateData.shuffles);
        const removed = (current.shuffles ?? []).filter(
            (name) => !next.has(name),
        );

        const blockingEvents = await findEventsUsingShuffles(id, removed);
        if (blockingEvents.length > 0) {
            const titles = blockingEvents
                .map((event) => `"${event.title}"`)
                .join(", ");
            throw new ClientApiError(
                `לא ניתן למחוק את השאפלים ${removed
                    .map((name) => `"${name}"`)
                    .join(", ")} — הם בשימוש באירועים הבאים: ${titles}`,
            );
        }
    }

    return await basicOperations.updateItem(id, updateData);
}

export const DbSyllabus = {
    getItem: getFullSyllabus,
    ...basicOperations,
    updateItem: updateSyllabus,
    linkItem: addSyllabusToCurriculum,
    unlinkItem: removeSyllabusFromCurriculum,
    reorderModules,
} as const;
