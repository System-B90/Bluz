import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";

export function dayDomainReducer(
    state: NormalizedStore,
    action: Extract<Action, { type: "ADD_DAY" | "REMOVE_DAY" | "UPDATE_DAY" }>,
): NormalizedStore {
    switch (action.type) {
    case "UPDATE_DAY": {
        const existing = state.days[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            days: {
                ...state.days,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }

    case "ADD_DAY": {
        return {
            ...state,
            days: {
                ...state.days,
                [action.payload.day.id]: injectDocumentTimes(
                    action.payload.day,
                ),
            },
        };
    }

    case "REMOVE_DAY": {
        const { [action.payload.dayId]: _, ...remainingDays } = state.days;
        return {
            ...state,
            days: remainingDays,
        };
    }
    }
}
