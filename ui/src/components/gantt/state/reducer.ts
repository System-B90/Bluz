import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { curriculumDomainReducer } from "@/components/gantt/state/reducers/curriculum-reducer";
import { dayDomainReducer } from "@/components/gantt/state/reducers/day-reducer";
import { eventDomainReducer } from "@/components/gantt/state/reducers/event-reducer";
import { moduleDomainReducer } from "@/components/gantt/state/reducers/module-reducer";
import { syllabusDomainReducer } from "@/components/gantt/state/reducers/syllabus-reducer";
import { weekDomainReducer } from "@/components/gantt/state/reducers/week-reducer";

export type { Action };

// Dispatches to a per-entity sub-reducer (#225). Each sub-reducer owns the
// full store, since several actions (e.g. ADD_SYLLABUS, MOVE_EVENT) touch
// more than one slice atomically.
export function curriculumReducer(
    state: NormalizedStore,
    action: Action,
): NormalizedStore {
    switch (action.type) {
    case "SET_DATA":
    case "UPDATE_CURRICULUM":
        return curriculumDomainReducer(state, action);

    case "ADD_SYLLABUS":
    case "UPDATE_SYLLABUS":
    case "REMOVE_SYLLABUS":
    case "MERGE_SYLLABUS":
    case "REORDER_MODULES":
        return syllabusDomainReducer(state, action);

    case "ADD_MODULE":
    case "UPDATE_MODULE":
    case "REMOVE_MODULE":
    case "ALLOCATE_TIME_TO_MODULE":
    case "REORDER_EVENTS":
    case "MOVE_EVENT":
        return moduleDomainReducer(state, action);

    case "ADD_EVENT":
    case "UPDATE_EVENT":
    case "REMOVE_EVENT":
    case "ALLOCATE_TIME":
        return eventDomainReducer(state, action);

    case "ADD_WEEK":
    case "UPDATE_WEEK":
    case "REMOVE_WEEK":
        return weekDomainReducer(state, action);

    case "ADD_DAY":
    case "UPDATE_DAY":
    case "REMOVE_DAY":
        return dayDomainReducer(state, action);

    case "PURGE_ENTITY": {
        const { payload } = action;
        switch (payload.collection) {
        case "modules": {
            if (!(payload.id in state.modules)) return state;
            const modules = { ...state.modules };
            delete modules[payload.id];
            return { ...state, modules };
        }
        case "syllabuses": {
            if (!(payload.id in state.syllabuses)) return state;
            const syllabuses = { ...state.syllabuses };
            delete syllabuses[payload.id];
            return { ...state, syllabuses };
        }
        case "events": {
            if (!(payload.id in state.events)) return state;
            const events = { ...state.events };
            delete events[payload.id];
            return { ...state, events };
        }
        }
    }

    default:
        return state;
    }
}
