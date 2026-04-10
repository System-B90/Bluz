
import { Curriculum, CurriculumId, Module, ModuleEvent, ModuleEventId, ModuleId, Syllabus, SyllabusId } from '@/api-shared/types/gant/curriculum';
import { createContext, useReducer, useContext } from 'react';

// The reducer handles mutations (e.g., updating an event's time)
function curriculumReducer(state, action)
{
    switch (action.type)
    {
        case 'UPDATE_EVENT_TIME':
            return {
                ...state,
                events: {
                    ...state.events,
                    [ action.payload.id ]: {
                        ...state.events[ action.payload.id ],
                        ideal_time: action.payload.newTime
                    }
                }
            };
        // Note: Mutating events does NOT re-create the curriculums, syllabuses, or modules objects!
        default: return state;
    }
}

const CurriculumContext = createContext();

export function CurriculumProvider({ initialNestedData, children })
{
    // Normalize exactly once on mount
    const initialState = normalizeCurriculumData(initialNestedData);
    const [ state, dispatch ] = useReducer(curriculumReducer, initialState);

    return (
        <CurriculumContext.Provider value= {{ state, dispatch; }
}>
    { children }
    </CurriculumContext.Provider>
  );
}

