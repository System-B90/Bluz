import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";

export function syllabusDomainReducer(
    state: NormalizedStore,
    action: Extract<
        Action,
        {
            type:
                | "ADD_SYLLABUS"
                | "UPDATE_SYLLABUS"
                | "REMOVE_SYLLABUS"
                | "MERGE_SYLLABUS"
                | "REORDER_MODULES";
        }
    >,
): NormalizedStore {
    switch (action.type) {
    case "UPDATE_SYLLABUS": {
        const existing = state.syllabuses[action.payload.id];
        if (!existing) return state;
        return {
            ...state,
            syllabuses: {
                ...state.syllabuses,
                [action.payload.id]: {
                    ...existing,
                    ...action.payload.updates,
                },
            },
        };
    }

    case "ADD_SYLLABUS": {
        const parent = state.curriculums[action.payload.curriculumId];
        if (!parent) return state;
        return {
            ...state,
            syllabuses: {
                ...state.syllabuses,
                [action.payload.syllabus.id]: injectDocumentTimes({
                    ...action.payload.syllabus,
                    curriculumId: parent.id,
                }),
            },
            curriculums: {
                ...state.curriculums,
                [parent.id]: {
                    ...parent,
                    syllabuses: [
                        ...parent.syllabuses,
                        action.payload.syllabus.id,
                    ],
                },
            },
        };
    }

    case "MERGE_SYLLABUS": {
        // Fold a fully-populated syllabus (its modules + events already
        // resolved) into the store. Used by the link flow so a linked
        // syllabus shows its real module count immediately (#320), instead
        // of an empty subtree until the next full refetch.
        const parent = state.curriculums[action.payload.curriculumId];
        if (!parent) return state;

        const mergedModules = { ...state.modules };
        for (const moduleDoc of action.payload.modules) {
            mergedModules[moduleDoc.id] = injectDocumentTimes(moduleDoc);
        }

        const mergedEvents = { ...state.events };
        for (const eventDoc of action.payload.events) {
            mergedEvents[eventDoc.id] = injectDocumentTimes(eventDoc);
        }

        const alreadyLinked = parent.syllabuses.includes(
            action.payload.syllabus.id,
        );

        return {
            ...state,
            events: mergedEvents,
            modules: mergedModules,
            syllabuses: {
                ...state.syllabuses,
                [action.payload.syllabus.id]: injectDocumentTimes(
                    action.payload.syllabus,
                ),
            },
            curriculums: {
                ...state.curriculums,
                [parent.id]: {
                    ...parent,
                    syllabuses: alreadyLinked
                        ? parent.syllabuses
                        : [...parent.syllabuses, action.payload.syllabus.id],
                },
            },
        };
    }

    case "REMOVE_SYLLABUS": {
        const parent = state.curriculums[action.payload.curriculumId];
        if (!parent) return state;
        return {
            ...state,
            curriculums: {
                ...state.curriculums,
                [parent.id]: {
                    ...parent,
                    syllabuses: parent.syllabuses.filter(
                        (id) => id !== action.payload.syllabusId,
                    ),
                },
            },
        };
    }

    case "REORDER_MODULES": {
        const syllabus = state.syllabuses[action.payload.syllabusId];
        if (!syllabus) return state;
        return {
            ...state,
            syllabuses: {
                ...state.syllabuses,
                [syllabus.id]: {
                    ...syllabus,
                    modules: action.payload.moduleIds,
                },
            },
        };
    }
    }
}
