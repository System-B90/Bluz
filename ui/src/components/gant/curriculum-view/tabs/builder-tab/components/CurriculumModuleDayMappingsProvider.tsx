/**
 * Name: CurriculumMappingProvider.tsx
 * Purpose: High-performance state management for module-to-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

import { curriculumModuleDayMappingApi } from '@/api-client/gant/mappings';
import { BaseDbDocument } from '@/api-server/curriculum/db-base';
import { CurriculumId, ModuleId } from "@/api-shared/types/gant/curriculum";
import { CurriculumModuleDayMapping } from "@/api-shared/types/gant/mapping";

/**
 * State Definition
 */
interface MappingState
{
    // Key: `${weekIndex}-${dayIndex}-${moduleId}`
    mappings: Record<string, CurriculumModuleDayMapping>;
    isLoading: boolean;
    error: null | string;
}

type MappingAction =
    | { type: 'DELETE_MAPPING'; payload: { weekIndex: number; dayIndex: number; moduleId: ModuleId; }; }
    | { type: 'SET_ERROR'; payload: null | string; }
    | { type: 'SET_LOADING'; payload: boolean; }
    | { type: 'SET_MAPPINGS'; payload: CurriculumModuleDayMapping[]; }
    | { type: 'UPSERT_MAPPING'; payload: CurriculumModuleDayMapping; };

const getMappingKey = (m: { weekIndex: number; dayIndex: number; moduleId: ModuleId; }) =>
    `${m.weekIndex}-${m.dayIndex}-${m.moduleId}`;

/**
 * High-Performance Reducer
 */
function mappingReducer(state: MappingState, action: MappingAction): MappingState
{
    switch (action.type)
    {
        case 'SET_MAPPINGS':
            const newMappings: Record<string, CurriculumModuleDayMapping> = {};
            action.payload.forEach(m => { newMappings[ getMappingKey(m) ] = m; });
            return { ...state, mappings: newMappings, isLoading: false };

        case 'UPSERT_MAPPING':
            return {
                ...state,
                mappings: {
                    ...state.mappings,
                    [ getMappingKey(action.payload) ]: action.payload
                }
            };

        case 'DELETE_MAPPING':
            const updated = { ...state.mappings };
            delete updated[ getMappingKey(action.payload) ];
            return { ...state, mappings: updated };

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload };

        default:
            return state;
    }
}

type CurriculumMappingContextType = {
    state: MappingState;
    refreshMappings: () => Promise<void>;
    createMapping: (moduleId: ModuleId, weekIndex: number, dayIndex: number) => Promise<void>;
    moveModule: (moduleId: ModuleId, from: { w: number, d: number; }, to: { w: number, d: number; }) => Promise<void>;
    removeModule: (moduleId: ModuleId, weekIndex: number, dayIndex: number) => Promise<void>;
};

/**
 * Provider Context
 */
const CurriculumMappingContext = createContext<CurriculumMappingContextType | undefined>(undefined);

export function CurriculumMappingProvider({ children, curriculumId }: { children: React.ReactNode; curriculumId: CurriculumId; })
{
    const [ state, dispatch ] = useReducer(mappingReducer, {
        mappings: {},
        isLoading: false,
        error: null
    });

    const refreshMappings = useCallback(async () =>
    {
        dispatch({ type: 'SET_LOADING', payload: true });
        try
        {
            const data = await curriculumModuleDayMappingApi.apiGet(curriculumId);
            dispatch({ type: 'SET_MAPPINGS', payload: data });
        } catch (e)
        {
            dispatch({ type: 'SET_ERROR', payload: JSON.stringify(e) });
        }
    }, [ dispatch, curriculumId ]);

    /**
         * createMapping: Handles assigning a module to a day for the first time.
         */
    const createMapping = useCallback(async (
        moduleId: ModuleId,
        weekIndex: number,
        dayIndex: number
    ) =>
    {
        const tempSortOrder = Date.now();
        const optimisticMapping: CurriculumModuleDayMapping & BaseDbDocument = {
            curriculumId,
            moduleId,
            weekIndex,
            dayIndex,
            sortOrder: tempSortOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Optimistic UI Update
        dispatch({ type: 'UPSERT_MAPPING', payload: optimisticMapping });

        try
        {
            const result = await curriculumModuleDayMappingApi.apiCreate(curriculumId, {
                moduleId,
                weekIndex,
                dayIndex,
                sortOrder: tempSortOrder
            });
            // Update with the actual data from the server (e.g., if IDs or timestamps were generated)
            dispatch({ type: 'UPSERT_MAPPING', payload: result });
        } catch (e)
        {
            // Rollback on failure
            dispatch({ type: 'DELETE_MAPPING', payload: { weekIndex, dayIndex, moduleId } });
            dispatch({ type: 'SET_ERROR', payload: JSON.stringify(e) });
        }
    }, [ dispatch, curriculumId ]);

    const moveModule = useCallback(async (
        moduleId: ModuleId,
        from: { w: number, d: number; },
        to: { w: number, d: number; }
    ) =>
    {
        // Optimistic UI Update
        const oldKey = getMappingKey({ weekIndex: from.w, dayIndex: from.d, moduleId });
        const originalMapping = state.mappings[ oldKey ];

        if (!originalMapping) return;

        const updatedMapping = { ...originalMapping, weekIndex: to.w, dayIndex: to.d };

        dispatch({ type: 'DELETE_MAPPING', payload: { weekIndex: from.w, dayIndex: from.d, moduleId } });
        dispatch({ type: 'UPSERT_MAPPING', payload: updatedMapping });

        try
        {
            await curriculumModuleDayMappingApi.apiUpdate(
                curriculumId,
                { moduleId, weekIndex: from.w, dayIndex: from.d },
                { weekIndex: to.w, dayIndex: to.d }
            );
        } catch (e)
        {
            // Rollback on failure
            dispatch({ type: 'DELETE_MAPPING', payload: { weekIndex: to.w, dayIndex: to.d, moduleId } });
            dispatch({ type: 'UPSERT_MAPPING', payload: originalMapping });
            dispatch({ type: 'SET_ERROR', payload: JSON.stringify(e) });
        }
    }, [ state.mappings, curriculumId, dispatch ]);

    const removeModule = useCallback(async (moduleId: ModuleId, weekIndex: number, dayIndex: number) =>
    {
        dispatch({ type: 'DELETE_MAPPING', payload: { weekIndex, dayIndex, moduleId } });
        try
        {
            await curriculumModuleDayMappingApi.apiDelete(curriculumId, moduleId, weekIndex, dayIndex);
        } catch 
        {
            refreshMappings(); // Re-sync on failure
        }
    }, [ refreshMappings, dispatch, curriculumId ]);

    useEffect(() => { refreshMappings(); }, [ refreshMappings ]); // Initial load

    const value = useMemo(() => ({ state, refreshMappings, moveModule, removeModule, createMapping }), [ state, refreshMappings, moveModule, removeModule, createMapping ]);

    return (
        <CurriculumMappingContext.Provider value={ value } >
            { children }
        </CurriculumMappingContext.Provider>
    );
}

/**
 * Hook for specialized access
 */
export function useCurriculumMappings()
{
    const context = useContext(CurriculumMappingContext);
    if (!context) throw new Error("useCurriculumMappings must be used within a CurriculumMappingProvider");
    return context;
}
