import { GanttCurriculumModuleDayMapping, GanttDayId, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";

/**
 * State Definition
 */
export interface GanttMappingState
{
    // Key: `${dayId}-${moduleId}-${eventId ?? 'null'}`
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    isLoading: boolean;
}

export type GanttMappingAction =
    | {
        type: "DELETE_MAPPING";
        payload: Pick<GanttCurriculumModuleDayMapping, 'dayId' | 'moduleId' | "eventId">;
    }
    | { type: "SET_LOADING"; payload: boolean; }
    | { type: "SET_MAPPINGS"; payload: Array<GanttCurriculumModuleDayMapping>; }
    | { type: "UPSERT_MAPPING"; payload: GanttCurriculumModuleDayMapping; };

export const getGanttMappingKey = (m: { dayId: GanttDayId; moduleId: GanttModuleId; eventId?: GanttEventId | null; }) =>
    `${m.dayId}-${m.moduleId}-${m.eventId ?? 'null'}`;

