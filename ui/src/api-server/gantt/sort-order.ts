import { asc, eq, sql, SQL } from "drizzle-orm";

import {
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
} from "@/api-server/gantt/schema";
import {
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

/**
 * `sort_order` for a module appended to `syllabusId`: one past the current
 * last. Linking with the column default (0) put new rows at the top after a
 * reload, so a saved order looked lost (#761).
 */
export function nextModuleSortOrder(syllabusId: GanttSyllabusId): SQL {
    return sql`(select coalesce(max(${ganttSyllabus2ModulesSchema.sortOrder}) + 1, 0) from ${ganttSyllabus2ModulesSchema} where ${eq(ganttSyllabus2ModulesSchema.syllabusId, syllabusId)})`;
}

/** `sort_order` for an event appended to `moduleId`. See {@link nextModuleSortOrder}. */
export function nextEventSortOrder(moduleId: GanttModuleId): SQL {
    return sql`(select coalesce(max(${ganttModule2EventsSchema.sortOrder}) + 1, 0) from ${ganttModule2EventsSchema} where ${eq(ganttModule2EventsSchema.moduleId, moduleId)})`;
}

/** Stable s2m order: rows sharing a `sort_order` (legacy data) never swap between reads. */
export const S2M_ORDER = [
    asc(ganttSyllabus2ModulesSchema.sortOrder),
    asc(ganttSyllabus2ModulesSchema.moduleId),
];

/** Stable m2e order. See {@link S2M_ORDER}. */
export const M2E_ORDER = [
    asc(ganttModule2EventsSchema.sortOrder),
    asc(ganttModule2EventsSchema.eventId),
];
