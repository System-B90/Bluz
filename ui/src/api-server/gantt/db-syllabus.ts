import { and, arrayOverlaps, asc, eq, inArray, sql } from "drizzle-orm";

import { GanttDbExecutor, postgresDb } from "@/api-server/gantt";
import { asWireShape, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, postgresErrorCode, UNIQUE_VIOLATION } from "@/api-server/gantt/db-base";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttModulesSchema,
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
import { ShuffleUsages } from "@/api-shared/types/gantt/shuffles";

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
    return asWireShape<ApiSyllabus>(result);
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
    if (moduleIds.length === 0) return;

    // One statement with a CASE ladder instead of an awaited UPDATE per module
    // - reordering a large syllabus was N sequential round trips (#538 item 9).
    const order = sql.join(
        moduleIds.map(
            (moduleId, index) =>
                sql`when ${ganttSyllabus2ModulesSchema.moduleId} = ${moduleId} then ${index}::integer`,
        ),
        sql` `,
    );

    await postgresDb
        .update(ganttSyllabus2ModulesSchema)
        .set({ sortOrder: sql`case ${order} end` })
        .where(
            and(
                eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId),
                inArray(ganttSyllabus2ModulesSchema.moduleId, moduleIds),
            ),
        );
}

/**
 * Modules and events under `syllabusId` tagged with any of `shuffleNames`.
 *
 * Walks s2m → m2e so the scan stays scoped to the syllabus that owns the
 * names; an event reached through another syllabus keeps its own tags.
 */
async function findShuffleUsages(
    syllabusId: GanttSyllabusId,
    shuffleNames: Array<string>,
    executor: GanttDbExecutor = postgresDb,
): Promise<ShuffleUsages> {
    const empty: ShuffleUsages = { events: [], modules: [] };
    if (shuffleNames.length === 0) return empty;

    const moduleIds = await syllabusModuleIds(syllabusId, executor);
    if (moduleIds.length === 0) return empty;

    const modules = await executor
        .select({
            id: ganttModulesSchema.id,
            shuffles: ganttModulesSchema.shuffles,
            title: ganttModulesSchema.title,
        })
        .from(ganttModulesSchema)
        .where(
            and(
                inArray(ganttModulesSchema.id, moduleIds),
                arrayOverlaps(ganttModulesSchema.shuffles, shuffleNames),
            ),
        );

    const events = await executor
        .selectDistinct({
            id: ganttEventsSchema.id,
            shuffles: ganttEventsSchema.shuffles,
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

    return { events, modules };
}

async function syllabusModuleIds(
    syllabusId: GanttSyllabusId,
    executor: GanttDbExecutor = postgresDb,
): Promise<Array<GanttModuleId>> {
    const rows = await executor
        .select({ moduleId: ganttSyllabus2ModulesSchema.moduleId })
        .from(ganttSyllabus2ModulesSchema)
        .where(eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId));
    return rows.map((row) => row.moduleId);
}

async function readShuffles(
    id: GanttSyllabusId,
    executor: GanttDbExecutor = postgresDb,
): Promise<Array<string>> {
    const current = await executor.query.ganttSyllabusesSchema.findFirst({
        columns: { shuffles: true },
        where: eq(ganttSyllabusesSchema.id, id),
    });

    if (!current) {
        throw new ClientApiError(`סילבוס עם מזהה ${id} לא נמצא לעדכון`);
    }

    return current.shuffles ?? [];
}

function removedShuffles(
    current: Array<string>,
    next: Array<string>,
): Array<string> {
    const kept = new Set(next);
    return current.filter((name) => !kept.has(name));
}

/**
 * Replaces the syllabus' shuffle list, cascading every removed name off the
 * modules and events that carry it (#485).
 *
 * Without the cascade the child keeps a dangling name and the UI only offers
 * to clear it once the user retypes the deleted shuffle on the syllabus — so
 * the caller confirms first (see `ShufflesSection`) and this applies both
 * sides in one transaction.
 */
async function applyShuffles(
    id: GanttSyllabusId,
    shuffles: Array<string>,
): Promise<ShuffleUsages> {
    // Reading the current shuffles and their usages OUTSIDE the transaction
    // was a TOCTOU window: a concurrent edit between the read and the write
    // was silently clobbered by the stripped lists computed from stale rows
    // (#538 item 2). Both reads now happen inside the same transaction as the
    // writes they inform.
    return await postgresDb.transaction(async (tx) => {
        const removed = removedShuffles(await readShuffles(id, tx), shuffles);
        const usages = await findShuffleUsages(id, removed, tx);
        const strip = (names: Array<string>) =>
            names.filter((name) => !removed.includes(name));
        for (const usedModule of usages.modules) {
            await tx
                .update(ganttModulesSchema)
                .set({
                    shuffles: strip(usedModule.shuffles),
                    updatedAt: new Date(),
                })
                .where(eq(ganttModulesSchema.id, usedModule.id));
        }

        for (const event of usages.events) {
            await tx
                .update(ganttEventsSchema)
                .set({ shuffles: strip(event.shuffles), updatedAt: new Date() })
                .where(eq(ganttEventsSchema.id, event.id));
        }

        await tx
            .update(ganttSyllabusesSchema)
            .set({ shuffles, updatedAt: new Date() })
            .where(eq(ganttSyllabusesSchema.id, id));

        return usages;
    });
}

/**
 * Blocks a plain PATCH that drops a shuffle still in use (#485). Callers that
 * mean to cascade go through `applyShuffles` after confirming with the user.
 */
async function updateSyllabus(
    id: GanttSyllabusId,
    updateData: Partial<GanttSyllabus>,
): Promise<GanttSyllabus> {
    if (updateData.shuffles === undefined) {
        return await basicOperations.updateItem(id, updateData);
    }

    // The guard reads what the update then depends on, so the read and the
    // write share one transaction — otherwise a concurrent edit between them
    // could slip a newly-used shuffle past the block (#538 item 2).
    return await postgresDb.transaction(async (tx) => {
        const removed = removedShuffles(
            await readShuffles(id, tx),
            updateData.shuffles!,
        );
        const usages = await findShuffleUsages(id, removed, tx);
        const blocking = [...usages.modules, ...usages.events];

        if (blocking.length > 0) {
            const quoted = (names: Array<string>) =>
                names.map((name) => `"${name}"`).join(", ");
            throw new ClientApiError(
                `לא ניתן למחוק את השאפלים ${quoted(removed)} — הם בשימוש ב: ` +
                    quoted(blocking.map((item) => item.title)),
            );
        }

        return await basicOperations.updateItem(id, updateData, tx);
    });
}

export const DbSyllabus = {
    getItem: getFullSyllabus,
    ...basicOperations,
    applyShuffles,
    findShuffleUsages,
    updateItem: updateSyllabus,
    linkItem: addSyllabusToCurriculum,
    unlinkItem: removeSyllabusFromCurriculum,
    reorderModules,
} as const;
