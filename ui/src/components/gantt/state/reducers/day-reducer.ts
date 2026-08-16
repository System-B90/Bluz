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
        // The week's `days` array is what the views iterate; a day that only
        // lands in the `days` map is invisible until the next full refetch.
        const parentWeek = state.weeks[action.payload.day.weekId];
        return {
            ...state,
            days: {
                ...state.days,
                [action.payload.day.id]: injectDocumentTimes(
                    action.payload.day,
                ),
            },
            weeks: parentWeek
                ? {
                    ...state.weeks,
                    [parentWeek.id]: {
                        ...parentWeek,
                        days: parentWeek.days.includes(action.payload.day.id)
                            ? parentWeek.days
                            : [...parentWeek.days, action.payload.day.id],
                    },
                }
                : state.weeks,
        };
    }

    case "REMOVE_DAY": {
        const existingDay = state.days[action.payload.dayId];
        const { [action.payload.dayId]: _, ...remainingDays } = state.days;
        // Drop the id from its week too, or the views keep rendering a day
        // that no longer exists in the store.
        const parentWeek = existingDay
            ? state.weeks[existingDay.weekId]
            : undefined;
        return {
            ...state,
            days: remainingDays,
            weeks: parentWeek
                ? {
                    ...state.weeks,
                    [parentWeek.id]: {
                        ...parentWeek,
                        days: parentWeek.days.filter(
                            (dayId) => dayId !== action.payload.dayId,
                        ),
                    },
                }
                : state.weeks,
        };
    }
    }
}
