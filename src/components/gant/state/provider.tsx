"use client";

import { NormalizedStore, normalizeCurriculumData } from '@/api-client/gant/drizzle-normalize';
import { ApiCurriculum } from '@/api-shared/types/gant/api-layer';
import { Action, curriculumReducer } from '@/components/gant/state/reducer';
import React, { createContext, useReducer, useContext, useMemo, ReactNode } from 'react';

const CurriculumContext = createContext<{
    state: NormalizedStore;
    dispatch: React.Dispatch<Action>;
} | null>(null);

export function CurriculumProvider({
    initialData,
    children
}: {
    initialData: ApiCurriculum;
    children: ReactNode;
})
{
    // Initialize state by normalizing the nested API response
    const [ state, dispatch ] = useReducer(
        curriculumReducer,
        initialData,
        normalizeCurriculumData
    );

    // Memoize the value to prevent unnecessary renders if the parent re-renders
    const value = useMemo(() => ({ state, dispatch }), [ state ]);

    return (
        <CurriculumContext.Provider value={ value } >
            { children }
        </CurriculumContext.Provider>
    );
}

export function useCurriculumStore()
{
    const context = useContext(CurriculumContext);
    if (!context) throw new Error("useCurriculumStore must be used within a CurriculumProvider");
    return context;
}