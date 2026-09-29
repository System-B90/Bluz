import crypto from "crypto";

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import {
    countSyllabusNodes,
    ImportIdMaps,
    importConstraints,
    importSyllabusTree,
    MAX_IMPORT_NODES,
} from "@/api-server/gantt/import-tree";
import {
    ganttCurriculumsSchema,
    ganttCurriculum2WeeksSchema,
    ganttWeeksSchema,
    ganttWeek2DaysSchema,
    ganttDaysSchema,
    ganttCurriculumEventDayMappingsSchema,
} from "@/api-server/gantt/schema";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";

export const dynamic = "force-dynamic";

/**
 * Counts the entities the import would create (weeks, days, syllabuses,
 * modules, events, mappings, constraints) without touching the DB, so an
 * oversized payload is rejected up front rather than mid-transaction.
 */
function countImportNodes(
    curriculum: ApiCurriculum,
    mappings: unknown,
    constraints: unknown,
): number {
    let count = 1; // the curriculum itself
    if (Array.isArray(curriculum?.c2w)) {
        for (const c2w of curriculum.c2w) {
            count += 1;
            const days = c2w?.week?.w2d;
            if (Array.isArray(days)) count += days.length;
        }
    }
    if (Array.isArray(curriculum?.c2s)) {
        for (const c2s of curriculum.c2s) {
            count += countSyllabusNodes(c2s?.syllabus);
        }
    }
    if (Array.isArray(mappings)) count += mappings.length;
    if (Array.isArray(constraints)) count += constraints.length;
    return count;
}

export const POST = withApi(async (request: NextRequest) => {
    await requireStaffSession();
    const { curriculum, mappings, constraints } = await requireJsonObjectBody<{
        curriculum?: ApiCurriculum;
        mappings?: unknown;
        constraints?: unknown;
    }>(request);

    if (!curriculum || !curriculum.title) {
        throw new ClientApiError("שגיאה: נתוני גאנט לא תקינים.");
    }

    if (
        countImportNodes(curriculum, mappings, constraints) > MAX_IMPORT_NODES
    ) {
        throw new ClientApiError("שגיאה: קובץ הייבוא גדול מדי.");
    }

    const newCurriculumId = `c_${crypto.randomUUID()}`;
    const oldCurriculumId = curriculum.id;

    const dayIdMap: Record<string, string> = {};
    const maps: ImportIdMaps = { moduleIdMap: {}, eventIdMap: {} };
    const { moduleIdMap, eventIdMap } = maps;

    const result = await postgresDb.transaction(async (tx) => {
        // 1. Create Curriculum
        const now = new Date();
        const [newCurriculum] = await tx
            .insert(ganttCurriculumsSchema)
            .values({
                id: newCurriculumId,
                title: `${curriculum.title} (מיובא)`,
                description: curriculum.description || "",
                startDate: curriculum.startDate,
                isDraft: true,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        // 2. Import Weeks and Days
        if (Array.isArray(curriculum.c2w)) {
            for (const c2wItem of curriculum.c2w) {
                const oldWeek = c2wItem.week;
                if (!oldWeek) continue;

                const newWeekId = `w_${crypto.randomUUID()}`;
                await tx.insert(ganttWeeksSchema).values({
                    id: newWeekId,
                    number: oldWeek.number,
                    comment: oldWeek.comment || "",
                    weekendDuty: oldWeek.weekendDuty || false,
                    createdAt: now,
                    updatedAt: now,
                });

                await tx.insert(ganttCurriculum2WeeksSchema).values({
                    curriculumId: newCurriculumId,
                    weekId: newWeekId,
                });

                if (Array.isArray(oldWeek.w2d)) {
                    for (const w2dItem of oldWeek.w2d) {
                        const oldDay = w2dItem.day;
                        if (!oldDay) continue;

                        const newDayId = `d_${crypto.randomUUID()}`;
                        dayIdMap[oldDay.id] = newDayId;

                        await tx.insert(ganttDaysSchema).values({
                            id: newDayId,
                            dayIndex: oldDay.dayIndex,
                            totalWorkingMinutes:
                                oldDay.totalWorkingMinutes || 0,
                            dayEndTime: oldDay.dayEndTime ?? null,
                            comment: oldDay.comment || "",
                            createdAt: now,
                            updatedAt: now,
                        });

                        await tx.insert(ganttWeek2DaysSchema).values({
                            weekId: newWeekId,
                            dayId: newDayId,
                        });
                    }
                }
            }
        }

        // 3. Import Syllabuses, Modules, and Events
        if (Array.isArray(curriculum.c2s)) {
            for (const c2sItem of curriculum.c2s) {
                if (!c2sItem.syllabus) continue;
                await importSyllabusTree(tx, c2sItem.syllabus, {
                    curriculumId: newCurriculumId,
                    sourceCurriculumId: oldCurriculumId,
                    now,
                    maps,
                });
            }
        }

        // 4. Import Mappings (cMDA)
        if (Array.isArray(mappings)) {
            for (const mapping of mappings) {
                const newModuleId = moduleIdMap[mapping.moduleId];
                const newDayId = dayIdMap[mapping.dayId];
                if (!newModuleId || !newDayId) continue;

                const newEventId = mapping.eventId
                    ? eventIdMap[mapping.eventId]
                    : null;

                await tx.insert(ganttCurriculumEventDayMappingsSchema).values({
                    id: crypto.randomUUID(),
                    curriculumId: newCurriculumId,
                    moduleId: newModuleId,
                    eventId: newEventId,
                    dayId: newDayId,
                    sortOrder: mapping.sortOrder || 0,
                    createdAt: now,
                    updatedAt: now,
                });
            }
        }

        // 5. Import Constraints
        await importConstraints(tx, constraints, maps, now);

        return newCurriculum;
    });

    // Convert Dates to strings to match frontend client expectations for response data
    const responseData = {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };

    return ApiSuccess(responseData);
});
