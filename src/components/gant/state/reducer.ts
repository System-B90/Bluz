import { NormalizedStore, normalizeCurriculumData } from "@/api-client/gant/drizzle-normalize";
import { ApiCurriculum } from "@/api-shared/types/gant/api-layer";
import
{
    CurriculumId, Curriculum,
    SyllabusId, Syllabus,
    ModuleId, Module,
    ModuleEventId, ModuleEvent
} from "@/api-shared/types/gant/curriculum";

export type Action =
    | { type: 'SET_DATA'; payload: ApiCurriculum; }

    // Updates
    | { type: 'UPDATE_CURRICULUM'; payload: { id: CurriculumId; updates: Partial<Curriculum>; }; }
    | { type: 'UPDATE_SYLLABUS'; payload: { id: SyllabusId; updates: Partial<Syllabus>; }; }
    | { type: 'UPDATE_MODULE'; payload: { id: ModuleId; updates: Partial<Module>; }; }
    | { type: 'UPDATE_EVENT'; payload: { id: ModuleEventId; updates: Partial<ModuleEvent>; }; }

    // Adds
    | { type: 'ADD_SYLLABUS'; payload: { curriculumId: CurriculumId; syllabus: Syllabus; }; }
    | { type: 'ADD_MODULE'; payload: { syllabusId: SyllabusId; module: Module; }; }
    | { type: 'ADD_EVENT'; payload: { moduleId: ModuleId; event: ModuleEvent; }; }

    // Removes
    | { type: 'REMOVE_SYLLABUS'; payload: { curriculumId: CurriculumId; syllabusId: SyllabusId; }; }
    | { type: 'REMOVE_MODULE'; payload: { syllabusId: SyllabusId; moduleId: ModuleId; }; }
    | { type: 'REMOVE_EVENT'; payload: { moduleId: ModuleId; eventId: ModuleEventId; }; };

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

        case 'ADD_SYLLABUS': {
            const parent = state.curriculums[ action.payload.curriculumId ];
            if (!parent) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [ action.payload.syllabus.id ]: action.payload.syllabus
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
                    [ action.payload.module.id ]: action.payload.module
                },
                syllabuses: {
                    ...state.syllabuses,
                    [ parent.id ]: {
                        ...parent,
                        modules: [ ...parent.modules, action.payload.module.id ]
                    }
                }
            };
        }

        case 'ADD_EVENT': {
            const parent = state.modules[ action.payload.moduleId ];
            if (!parent) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [ action.payload.event.id ]: action.payload.event
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
