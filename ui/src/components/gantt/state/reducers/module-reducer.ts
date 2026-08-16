import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    AllocateTimeToEventCallback,
    allocateTimeToModule,
} from "@/api-shared/gantt/allocate-time";
import { Action } from "@/components/gantt/state/reducers/actions";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";

export function moduleDomainReducer(
    state: NormalizedStore,
    action: Extract<
        Action,
        {
            type:
                | "ADD_MODULE"
                | "ALLOCATE_TIME_TO_MODULE"
                | "MOVE_EVENT"
                | "REMOVE_MODULE"
                | "REORDER_EVENTS"
                | "UPDATE_MODULE";
        }
    >,
): NormalizedStore {
    switch (action.type) {
    case "UPDATE_MODULE": {
        const existing = state.modules[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            modules: {
                ...state.modules,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }

    case "ALLOCATE_TIME_TO_MODULE": {
        const moduleDoc = state.modules[action.payload.moduleId];
        if (!moduleDoc) return state;

        const updatedEvents = { ...state.events };

        const updateModuleEvent: AllocateTimeToEventCallback = ({
            eventId,
            duration,
        }) => {
            const eventDoc = state.events[eventId];
            if (!eventDoc) return;
            updatedEvents[eventId] = {
                ...eventDoc,
                allocatedDuration: duration,
            };
        };

        allocateTimeToModule({
            module: moduleDoc,
            totalDuration: action.payload.duration,
            curriculumId: action.payload.curriculumId,
            moduleEvents: state.events,
            allocateToEventCallback: updateModuleEvent,
        });

        return { ...state, events: updatedEvents };
    }

    case "ADD_MODULE": {
        const parent = state.syllabuses[action.payload.syllabusId];
        if (!parent) return state;
        return {
            ...state,
            modules: {
                ...state.modules,
                [action.payload.module.id]: injectDocumentTimes({
                    ...action.payload.module,
                    syllabusId: parent.id,
                }),
            },
            syllabuses: {
                ...state.syllabuses,
                [parent.id]: {
                    ...parent,
                    modules: [...parent.modules, action.payload.module.id],
                },
            },
        };
    }

    case "REMOVE_MODULE": {
        const parent = state.syllabuses[action.payload.syllabusId];
        if (!parent) return state;
        // A module owns its events; dropping only the id from the syllabus
        // leaves both the module and its events orphaned in the store.
        const existingModule = state.modules[action.payload.moduleId];
        const { [action.payload.moduleId]: _, ...remainingModules } =
                state.modules;
        const remainingEvents = { ...state.events };
        for (const eventId of existingModule?.events ?? []) {
            delete remainingEvents[eventId];
        }
        return {
            ...state,
            events: remainingEvents,
            modules: remainingModules,
            syllabuses: {
                ...state.syllabuses,
                [parent.id]: {
                    ...parent,
                    modules: parent.modules.filter(
                        (id) => id !== action.payload.moduleId,
                    ),
                },
            },
        };
    }

    case "MOVE_EVENT": {
        const { eventId, fromModuleId, toModuleId } = action.payload;
        const fromModule = state.modules[fromModuleId];
        const toModule = state.modules[toModuleId];
        const event = state.events[eventId];
        if (!fromModule || !toModule || !event) return state;
        return {
            ...state,
            events: {
                ...state.events,
                [eventId]: { ...event, moduleId: toModuleId },
            },
            modules: {
                ...state.modules,
                [fromModuleId]: {
                    ...fromModule,
                    events: fromModule.events.filter((id) => id !== eventId),
                },
                [toModuleId]: {
                    ...toModule,
                    events: [...toModule.events, eventId],
                },
            },
        };
    }

    case "REORDER_EVENTS": {
        const moduleDoc = state.modules[action.payload.moduleId];
        if (!moduleDoc) return state;
        return {
            ...state,
            modules: {
                ...state.modules,
                [moduleDoc.id]: {
                    ...moduleDoc,
                    events: action.payload.eventIds,
                },
            },
        };
    }
    }
}
