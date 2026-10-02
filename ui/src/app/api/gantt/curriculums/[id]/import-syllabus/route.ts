import { NextRequest } from "next/server";

import { ApiSuccess, requireJsonObjectBody, withApi } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { FOREIGN_KEY_VIOLATION, postgresErrorCode } from "@/api-server/gantt/db-base";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import {
    countSyllabusNodes,
    ImportIdMaps,
    importConstraints,
    importSyllabusTree,
    MAX_IMPORT_NODES,
} from "@/api-server/gantt/import-tree";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { SYLLABUS_EXPORT_KIND, SyllabusExportDocument } from "@/api-shared/types/gantt/syllabus-export";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Adds a syllabus exported with `/api/gantt/syllabuses/{id}/export` to this
 * curriculum as a new copy (#757). Returns the full syllabus tree.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id: curriculumId } = await context.params;
        if (!curriculumId) throw new ClientApiError("Curriculum ID is required.");

        const { kind, syllabus, constraints } =
            await requireJsonObjectBody<Partial<SyllabusExportDocument>>(request);

        if (kind !== SYLLABUS_EXPORT_KIND || !syllabus || !syllabus.title) {
            throw new ClientApiError("שגיאה: קובץ הסילבוס לא תקין.");
        }
        const nodes = countSyllabusNodes(syllabus) + (Array.isArray(constraints) ? constraints.length : 0);
        if (nodes > MAX_IMPORT_NODES) {
            throw new ClientApiError("שגיאה: קובץ הייבוא גדול מדי.");
        }

        const newSyllabusId = await postgresDb.transaction(async (tx) => {
            const now = new Date();
            const maps: ImportIdMaps = { moduleIdMap: {}, eventIdMap: {} };
            const syllabusId = await importSyllabusTree(tx, syllabus, {
                curriculumId,
                now,
                maps,
                titleSuffix: " (מיובא)",
            });
            await importConstraints(tx, constraints, maps, now);
            return syllabusId;
        }).catch((error: unknown) => {
            if (postgresErrorCode(error) === FOREIGN_KEY_VIOLATION) {
                throw new ClientApiError("הגאנט לא נמצא.");
            }
            throw error;
        });

        return ApiSuccess(await DbSyllabus.getItem(newSyllabusId as GanttSyllabusId));
    },
);
