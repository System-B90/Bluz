import { GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models";
import { GanttMappingAction, GanttMappingState, getGanttMappingKey } from "@/components/gantt/state/mappings/types";

/**
 * High-Performance Reducer
 */
export function ganttMappingReducer(
    state: GanttMappingState,
    action: GanttMappingAction,
): GanttMappingState
{
    switch (action.type)
    {
    case "SET_MAPPINGS":
        const newMappings: Record<string, GanttCurriculumModuleDayMapping> = {};
        action.payload.forEach((m) =>
        {
            newMappings[ getGanttMappingKey(m) ] = m;
        });
        return { ...state, mappings: newMappings, isLoading: false };

    case "UPSERT_MAPPING":
        return {
            ...state,
            mappings: {
                ...state.mappings,
                [ getGanttMappingKey(action.payload) ]: action.payload,
            },
        };

    case "DELETE_MAPPING":
        const updated = { ...state.mappings };
        delete updated[ getGanttMappingKey(action.payload) ];
        return { ...state, mappings: updated };

    case "SET_LOADING":
        return { ...state, isLoading: action.payload };

    default:
        return state;
    }
}
