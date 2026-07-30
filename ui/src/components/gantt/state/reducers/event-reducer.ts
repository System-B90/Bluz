import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";

export function eventDomainReducer(
    state: NormalizedStore,
    action: Extract<
        Action,
        { type: "ADD_EVENT" | "UPDATE_EVENT" | "REMOVE_EVENT" | "ALLOCATE_TIME" }
    >,
): NormalizedStore {
    switch (action.type) {
    case "UPDATE_EVENT": {
        const existing = state.events[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            events: {
                ...state.events,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }

    case "ALLOCATE_TIME": {
        const existing = state.events[action.payload.eventId];
        if (!existing) return state;
        return {
            ...state,
            events: {
                ...state.events,
                [action.payload.eventId]: {
                    ...existing,
                    allocatedDuration: action.payload.duration,
                },
            },
        };
    }

    case "ADD_EVENT": {
        const parent = state.modules[action.payload.moduleId];
        if (!parent) return state;
        return {
            ...state,
            events: {
                ...state.events,
                [action.payload.event.id]: injectDocumentTimes({
                    ...action.payload.event,
                    moduleId: parent.id,
                }),
            },
            modules: {
                ...state.modules,
                [parent.id]: {
                    ...parent,
                    events: [...parent.events, action.payload.event.id],
                },
            },
        };
    }

    case "REMOVE_EVENT": {
        const parent = state.modules[action.payload.moduleId];
        if (!parent) return state;
        return {
            ...state,
            modules: {
                ...state.modules,
                [parent.id]: {
                    ...parent,
                    events: parent.events.filter(
                        (id) => id !== action.payload.eventId,
                    ),
                },
            },
        };
    }
    }
}
