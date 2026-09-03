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
        // Purge removes the doc *and* the container's reference to it.
        // Dropping only the doc leaves a dangling id in the parent's list, and
        // every consumer that maps ids to docs then hits `undefined` --
        // `siblingModules` in module-dialog does exactly that, and
        // `modules.map((m) => m.id)` threw, so the dialog never rendered and
        // every gantt e2e spec failed in createModuleWithEvents (#495).
        switch (payload.collection) {
        case "modules": {
            const moduleDoc = state.modules[payload.id];
            if (!moduleDoc) return state;
            const modules = { ...state.modules };
            delete modules[payload.id];

            const parent = state.syllabuses[moduleDoc.syllabusId];
            if (!parent) return { ...state, modules };
            return {
                ...state,
                modules,
                syllabuses: {
                    ...state.syllabuses,
                    [parent.id]: {
                        ...parent,
                        modules: parent.modules.filter(
                            (id) => id !== payload.id,
                        ),
                    },
                },
            };
        }
        case "syllabuses": {
            const syllabus = state.syllabuses[payload.id];
            if (!syllabus) return state;
            const syllabuses = { ...state.syllabuses };
            delete syllabuses[payload.id];

            const parent = state.curriculums[syllabus.curriculumId];
            if (!parent) return { ...state, syllabuses };
            return {
                ...state,
                curriculums: {
                    ...state.curriculums,
                    [parent.id]: {
                        ...parent,
                        syllabuses: parent.syllabuses.filter(
                            (id) => id !== payload.id,
                        ),
                    },
                },
                syllabuses,
            };
        }
        case "events": {
            const event = state.events[payload.id];
            if (!event) return state;
            const events = { ...state.events };
            delete events[payload.id];

            const parent = state.modules[event.moduleId];
            if (!parent) return { ...state, events };
            return {
                ...state,
                events,
                modules: {
                    ...state.modules,
                    [parent.id]: {
                        ...parent,
                        events: parent.events.filter(
                            (id) => id !== payload.id,
                        ),
                    },
                },
            };
        }
        }
        return state;
    }

    default:
        return state;
    }
}
