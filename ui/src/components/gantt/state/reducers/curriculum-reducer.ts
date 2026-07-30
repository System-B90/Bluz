import { NormalizedStore, normalizeCurriculumData } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";

export function curriculumDomainReducer(
    state: NormalizedStore,
    action: Extract<Action, { type: "SET_DATA" | "UPDATE_CURRICULUM" }>,
): NormalizedStore {
    switch (action.type) {
    case "SET_DATA":
        return normalizeCurriculumData(action.payload);

    case "UPDATE_CURRICULUM": {
        const existing = state.curriculums[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            curriculums: {
                ...state.curriculums,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }
    }
}
