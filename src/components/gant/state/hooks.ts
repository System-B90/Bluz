import { curriculumApi, moduleApi, moduleEventApi, syllabusApi } from "@/api-client/gant/api";
import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { ModuleDocument } from "@/api-client/gant/module";
import { ModuleEventDocument } from "@/api-client/gant/module-event";
import { SyllabusDocument } from "@/api-client/gant/syllabus";
import { CurriculumId, SyllabusId, ModuleId, ModuleEventId, ModuleEvent, ModuleEventType, Module, Curriculum, Syllabus } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState, useCurriculumProviderActions } from "@/components/gant/state/provider";
export function useCurriculum(curriculumId: null): undefined;
export function useCurriculum(curriculumId: CurriculumId): CurriculumDocument | undefined;
export function useCurriculum(curriculumId: CurriculumId | null): CurriculumDocument | undefined
{
    const state = useCurriculumState();

    if (curriculumId === null)
    {
        return undefined;
    }

    return state.curriculums[ curriculumId ];
}


export function useSyllabus(syllabusId: null): undefined;
export function useSyllabus(syllabusId: SyllabusId): SyllabusDocument | undefined;
export function useSyllabus(syllabusId: SyllabusId | null): SyllabusDocument | undefined
{
    const state = useCurriculumState();

    if (syllabusId === null)
    {
        return undefined;
    }

    return state.syllabuses[ syllabusId ];
}


export function useModule(moduleId: null): undefined;
export function useModule(moduleId: ModuleId): ModuleDocument | undefined;
export function useModule(moduleId: ModuleId | null): ModuleDocument | undefined
{
    const state = useCurriculumState();

    if (moduleId === null)
    {
        return undefined;
    }

    return state.modules[ moduleId ];
}


export function useEvent(eventId: null): undefined;
export function useEvent(eventId: ModuleEventId): ModuleEventDocument | undefined;
export function useEvent(eventId: ModuleEventId | null): ModuleEventDocument | undefined
{
    const state = useCurriculumState();

    if (eventId === null)
    {
        return undefined;
    }

    return state.events[ eventId ];
}

/**
 * Provides action functions to Create, Delete, & Update gant items.
 * @returns Destructable object with all gant actions.
 */
export function useGantFuncs()
{
    const { dispatch } = useCurriculumProviderActions();

    const updateCurriculum = async (id: CurriculumId, updates: Partial<Curriculum>) =>
    {
        try
        {
            const updatedCurriculum = await curriculumApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id, updates: updatedCurriculum } });
        } catch (error)
        {
            console.error("Failed to update curriculum:", error);
            throw error;
        }
    };

    const createSyllabus = async (title: string, curriculumId: CurriculumId, hiveIds: number[] = []) =>
    {
        try
        {
            const newSyllabus = await syllabusApi.apiCreate({ title, curriculumId, hiveIds });
            dispatch({ type: 'ADD_SYLLABUS', payload: { syllabus: newSyllabus, curriculumId } });
            return newSyllabus;
        } catch (error)
        {
            console.error("Failed to create syllabus:", error);
            throw error;
        }
    };

    const updateSyllabus = async (id: SyllabusId, updates: Partial<Syllabus>) =>
    {
        try
        {
            const updatedSyllabus = await syllabusApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_SYLLABUS', payload: { id, updates: updatedSyllabus } });
        } catch (error)
        {
            console.error("Failed to update syllabus:", error);
            throw error;
        }
    };

    const removeSyllabus = async (curriculumId: CurriculumId, syllabusId: SyllabusId) =>
    {
        try
        {
            await syllabusApi.apiDelete(syllabusId);
            dispatch({ type: 'REMOVE_SYLLABUS', payload: { curriculumId, syllabusId } });
        } catch (error)
        {
            console.error("Failed to remove syllabus:", error);
            throw error;
        }
    };

    const createModule = async (title: string, syllabusId: SyllabusId, description: string = '', hiveIds: number[] = []) =>
    {
        try
        {
            const newModule = await moduleApi.apiCreate({ title, syllabusId, description, hiveIds });
            dispatch({ type: 'ADD_MODULE', payload: { module: newModule, syllabusId } });
            return newModule;
        } catch (error)
        {
            console.error("Failed to create module:", error);
            throw error;
        }
    };

    const updateModule = async (id: ModuleId, updates: Partial<Module>) =>
    {
        try
        {
            const updatedModule = await moduleApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_MODULE', payload: { id, updates: updatedModule } });
        } catch (error)
        {
            console.error("Failed to update module:", error);
            throw error;
        }
    };

    const removeModule = async (syllabusId: SyllabusId, moduleId: ModuleId) =>
    {
        try
        {
            await moduleApi.apiDelete(moduleId);
            dispatch({ type: 'REMOVE_MODULE', payload: { syllabusId, moduleId } });
        } catch (error)
        {
            console.error("Failed to remove module:", error);
            throw error;
        }
    };

    const createEvent = async (
        title: string,
        moduleId: ModuleId,
        type: ModuleEventType = ModuleEventType.Lecture,
        minimumDuration: number = 0,
        allocatedDuration: number = 0
    ) =>
    {
        try
        {
            const newEvent = await moduleEventApi.apiCreate({
                title,
                moduleId,
                type,
                minimumDuration,
                allocatedDuration,
                requirements: []
            });
            dispatch({ type: 'ADD_EVENT', payload: { event: newEvent, moduleId } });
            return newEvent;
        } catch (error)
        {
            console.error("Failed to create event:", error);
            throw error;
        }
    };

    const updateEvent = async (id: ModuleEventId, updates: Partial<ModuleEvent>) =>
    {
        try
        {
            const updatedEvent = await moduleEventApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_EVENT', payload: { id, updates: updatedEvent } });
        } catch (error)
        {
            console.error("Failed to update event:", error);
            throw error;
        }
    };

    const removeEvent = async (moduleId: ModuleId, eventId: ModuleEventId) =>
    {
        try
        {
            await moduleEventApi.apiDelete(eventId);
            dispatch({ type: 'REMOVE_EVENT', payload: { moduleId, eventId } });
        } catch (error)
        {
            console.error("Failed to remove event:", error);
            throw error;
        }
    };

    return {
        updateCurriculum,
        createSyllabus,
        updateSyllabus,
        removeSyllabus,
        createModule,
        updateModule,
        removeModule,
        createEvent,
        updateEvent,
        removeEvent,
    } as const;
}
