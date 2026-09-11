import {
    CurriculumListAction,
    CurriculumListState,
} from "@/components/gantt/state/curriculum-list/types";

export const initialCurriculumListState: CurriculumListState = {
    curriculums: {},
    isLoading: true,
    error: null,
};

export function curriculumListReducer(
    state: CurriculumListState,
    action: CurriculumListAction,
): CurriculumListState {
    switch (action.type) {
    case "SET_LOADING": {
        return {
            ...state,
            isLoading: action.payload,
        };
    }

    case "SET_ERROR": {
        return {
            ...state,
            isLoading: false,
            error: action.payload,
        };
    }

    case "SET_CURRICULUMS": {
        return {
            ...state,
            curriculums: action.payload,
            isLoading: false,
            error: null,
        };
    }

    case "ADD_CURRICULUM": {
        return {
            ...state,
            curriculums: {
                ...state.curriculums,
                [action.payload.id]: action.payload,
            },
        };
    }

    case "REMOVE_CURRICULUM": {
        const next = { ...state.curriculums };
        delete next[action.payload];
        return {
            ...state,
            curriculums: next,
        };
    }

    case "UPDATE_CURRICULUM": {
        const existing = state.curriculums[action.payload.id];
        if (!existing) {
            return state;
        }
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

    default:
        return state;
    }
}
