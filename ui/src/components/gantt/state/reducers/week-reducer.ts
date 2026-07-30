import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";

export function weekDomainReducer(
    state: NormalizedStore,
    action: Extract<Action, { type: "ADD_WEEK" | "UPDATE_WEEK" | "REMOVE_WEEK" }>,
): NormalizedStore {
    switch (action.type) {
    case "UPDATE_WEEK": {
        const existing = state.weeks[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            weeks: {
                ...state.weeks,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }

    case "ADD_WEEK": {
        const parentCurriculum =
            state.curriculums[action.payload.curriculumId];
        if (!parentCurriculum) return state;
        return {
            ...state,
            weeks: {
                ...state.weeks,
                [action.payload.week.id]: injectDocumentTimes({
                    ...action.payload.week,
                    curriculumId: action.payload.curriculumId,
                }),
            },
            curriculums: {
                ...state.curriculums,
                [action.payload.curriculumId]: {
                    ...parentCurriculum,
                    weeks: [
                        ...parentCurriculum.weeks,
                        action.payload.week.id,
                    ],
                },
            },
        };
    }

    case "REMOVE_WEEK": {
        const existingWeek = state.weeks[action.payload.weekId];
        const { [action.payload.weekId]: _, ...remainingWeeks } =
                state.weeks;
        const remainingDays = { ...state.days };

        for (const dayId of existingWeek?.days ?? []) {
            delete remainingDays[dayId];
        }

        const parent = state.curriculums[action.payload.curriculumId];

        return {
            ...state,
            weeks: remainingWeeks,
            days: remainingDays,
            curriculums: parent
                ? {
                    ...state.curriculums,
                    [parent.id]: {
                        ...parent,
                        weeks: parent.weeks.filter(
                            (weekId) => weekId !== action.payload.weekId,
                        ),
                    },
                }
                : state.curriculums,
        };
    }
    }
}
