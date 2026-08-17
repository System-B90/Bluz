import { GanttEventRecurrenceException } from "@/api-shared/types/gantt/models";
import {
    GanttRecurrenceExceptionAction,
    GanttRecurrenceExceptionState,
    getRecurrenceExceptionKey,
} from "@/components/gantt/state/recurrence-exceptions/types";

export function ganttRecurrenceExceptionReducer(
    state: GanttRecurrenceExceptionState,
    action: GanttRecurrenceExceptionAction,
): GanttRecurrenceExceptionState {
    switch (action.type) {
    case "SET_EXCEPTIONS": {
        const exceptions: Record<string, GanttEventRecurrenceException> = {};
        action.payload.forEach((e) => {
            exceptions[getRecurrenceExceptionKey(e)] = e;
        });
        return { ...state, exceptions, isLoading: false };
    }

    case "UPSERT_EXCEPTION":
        return {
            ...state,
            exceptions: {
                ...state.exceptions,
                [getRecurrenceExceptionKey(action.payload)]: action.payload,
            },
        };

    case "REMOVE_EXCEPTION": {
        const key = getRecurrenceExceptionKey(action.payload);
        if (!(key in state.exceptions)) return state;
        const exceptions = { ...state.exceptions };
        delete exceptions[key];
        return { ...state, exceptions };
    }

    case "SET_LOADING":
        return { ...state, isLoading: action.payload };

    default:
        return state;
    }
}
