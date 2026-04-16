import dayjs from "dayjs";

import { BaseDocument } from "@/api-client/gant/base";
import { NormalizedStore, normalizeCurriculumData } from "@/api-client/gant/drizzle-normalize";
import { AllocateTimeToEventCallback, allocateTimeToModule } from "@/api-shared/gantt/allocate-time";
import { ApiCurriculum } from "@/api-shared/types/gant/api-layer";
import
    {
        BaseGantItem,
        Curriculum,
        CurriculumId,
        Module,
        ModuleEvent,
        ModuleEventId,
        ModuleId,
        Syllabus,
        SyllabusId
    } from "@/api-shared/types/gant/curriculum";

export type Action =
    | { type: 'ADD_EVENT'; payload: { moduleId: ModuleId; event: ModuleEvent; }; }

    // Updates
    | { type: 'ADD_MODULE'; payload: { syllabusId: SyllabusId; module: Module; }; }
    | { type: 'ADD_SYLLABUS'; payload: { curriculumId: CurriculumId; syllabus: Syllabus; }; }
    | { type: 'ALLOCATE_TIME_TO_MODULE'; payload: { curriculumId: CurriculumId; moduleId: ModuleId; duration: number; }; }
    | { type: 'ALLOCATE_TIME'; payload: { curriculumId: CurriculumId; eventId: ModuleEventId; duration: number; }; }

    // Adds
    | { type: 'REMOVE_EVENT'; payload: { moduleId: ModuleId; eventId: ModuleEventId; }; }
    | { type: 'REMOVE_MODULE'; payload: { syllabusId: SyllabusId; moduleId: ModuleId; }; }
    | { type: 'REMOVE_SYLLABUS'; payload: { curriculumId: CurriculumId; syllabusId: SyllabusId; }; }

    // Removes
    | { type: 'SET_DATA'; payload: ApiCurriculum; }
    | { type: 'UPDATE_CURRICULUM'; payload: { id: CurriculumId; updates: Partial<Curriculum>; }; }
    | { type: 'UPDATE_EVENT'; payload: { id: ModuleEventId; updates: Partial<ModuleEvent>; }; }

    | { type: 'UPDATE_MODULE'; payload: { id: ModuleId; updates: Partial<Module>; }; }
    | { type: 'UPDATE_SYLLABUS'; payload: { id: SyllabusId; updates: Partial<Syllabus>; }; };

function injectDocumentTimes<T extends BaseGantItem>(rawDoc: T): T & BaseDocument
{
    return { ...rawDoc, createdAt: dayjs(), updatedAt: dayjs() };
}

export function curriculumReducer(state: NormalizedStore, action: Action): NormalizedStore
{
    switch (action.type)
    {
        case 'SET_DATA':
            return normalizeCurriculumData(action.payload);

        case 'UPDATE_CURRICULUM': {
            const existing = state.curriculums[ action.payload.id ];
            if (!existing) return state;
            return {
                ...state,
                curriculums: {
                    ...state.curriculums,
                    [ action.payload.id ]: { ...existing, ...action.payload.updates }
                }
            };
        }

        case 'UPDATE_SYLLABUS': {
            const existing = state.syllabuses[ action.payload.id ];
            if (!existing) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [ action.payload.id ]: { ...existing, ...action.payload.updates }
                }
            };
        }

        case 'UPDATE_MODULE': {
            const existing = state.modules[ action.payload.id ];
            if (!existing) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [ action.payload.id ]: { ...existing, ...action.payload.updates }
                }
            };
        }

        case 'UPDATE_EVENT': {
            const existing = state.events[ action.payload.id ];
            if (!existing) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [ action.payload.id ]: { ...existing, ...action.payload.updates }
                }
            };
        }

        case 'ALLOCATE_TIME': {
            const existing = state.events[ action.payload.eventId ];
            if (!existing) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [ action.payload.eventId ]: { ...existing, allocatedDuration: action.payload.duration }
                }
            };
        }

        case 'ALLOCATE_TIME_TO_MODULE': {
            const moduleDoc = state.modules[ action.payload.moduleId ];
            if (!moduleDoc) return state;

            const updatedEvents = state.events;

            const updateModuleEvent: AllocateTimeToEventCallback = ({ eventId, duration }) =>
            {
                const eventDoc = state.events[ eventId ];
                if (!eventDoc) return;
                updatedEvents[ eventId ] = { ...eventDoc, allocatedDuration: duration };
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

        case 'ADD_SYLLABUS': {
            const parent = state.curriculums[ action.payload.curriculumId ];
            if (!parent) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [ action.payload.syllabus.id ]: injectDocumentTimes(action.payload.syllabus)
                },
                curriculums: {
                    ...state.curriculums,
                    [ parent.id ]: {
                        ...parent,
                        syllabuses: [ ...parent.syllabuses, action.payload.syllabus.id ]
                    }
                }
            };
        }

        case 'ADD_MODULE': {
            const parent = state.syllabuses[ action.payload.syllabusId ];
            if (!parent) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [ action.payload.module.id ]: injectDocumentTimes(action.payload.module)
                },
                syllabuses: {
                    ...state.syllabuses,
                    [ parent.id ]: {
                        ...parent,
                        modules: [ ...parent.modules, action.payload.module.id ]
                    }
                },
                moduleToSyllabusLookup: {
                    ...state.moduleToSyllabusLookup,
                    [ action.payload.module.id ]: parent.id
                },
            };
        }

        case 'ADD_EVENT': {
            const parent = state.modules[ action.payload.moduleId ];
            if (!parent) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [ action.payload.event.id ]: injectDocumentTimes(action.payload.event)
                },
                modules: {
                    ...state.modules,
                    [ parent.id ]: {
                        ...parent,
                        events: [ ...parent.events, action.payload.event.id ]
                    }
                }
            };
        }

        case 'REMOVE_SYLLABUS': {
            const parent = state.curriculums[ action.payload.curriculumId ];
            if (!parent) return state;
            return {
                ...state,
                curriculums: {
                    ...state.curriculums,
                    [ parent.id ]: {
                        ...parent,
                        syllabuses: parent.syllabuses.filter(id => id !== action.payload.syllabusId)
                    }
                }
            };
        }

        case 'REMOVE_MODULE': {
            const parent = state.syllabuses[ action.payload.syllabusId ];
            if (!parent) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [ parent.id ]: {
                        ...parent,
                        modules: parent.modules.filter(id => id !== action.payload.moduleId)
                    }
                }
            };
        }

        case 'REMOVE_EVENT': {
            const parent = state.modules[ action.payload.moduleId ];
            if (!parent) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [ parent.id ]: {
                        ...parent,
                        events: parent.events.filter(id => id !== action.payload.eventId)
                    }
                }
            };
        }

        default:
            return state;
    }
}
