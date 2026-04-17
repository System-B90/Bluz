/**
 * Name: index.tsx (CurriculumGanttView)
 * Purpose: Main export for Gantt View tab, integrating SVAR with Bluz state.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

'use client';

import React, { useMemo } from 'react';

import { Curriculum, CurriculumId, Module, ModuleEvent, Syllabus } from '@/api-shared/types/gant/curriculum';
import { CurriculumMappingProvider } from '@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';
import { CurriculumGanttViewInner } from '@/components/gant/curriculum-view/tabs/gantt-view-tab/CurriculumGanttViewInner';
import { GanttDataSourceProps } from '@/components/gant/curriculum-view/tabs/gantt-view-tab/types';
import { useCurriculum } from '@/components/gant/state/hooks/UseCurriculum';
import { useCurriculumState } from '@/components/gant/state/provider';

export interface CurriculumGanttViewProps
{
    readonly curriculumId: CurriculumId;
}

export function CurriculumGanttView({ curriculumId }: CurriculumGanttViewProps): null | React.ReactElement
{
    const curriculum: Curriculum | undefined = useCurriculum(curriculumId);
    const state = useCurriculumState();

    const innerProps: GanttDataSourceProps | null = useMemo(
        (): GanttDataSourceProps | null =>
            curriculum
                ? {
                    curriculum,
                    syllabuses: Object.values(state.syllabuses) as Array<Syllabus>,
                    modules: Object.values(state.modules) as Array<Module>,
                    events: Object.values(state.events) as Array<ModuleEvent>
                }
                : null,
        [ curriculum, state ]
    );

    if (!innerProps) return null;

    return (
        <CurriculumMappingProvider curriculumId={ curriculumId }>
            <CurriculumGanttViewInner { ...innerProps } />
        </CurriculumMappingProvider>
    );
}
