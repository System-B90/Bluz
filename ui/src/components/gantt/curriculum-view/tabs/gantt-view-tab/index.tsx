/**
 * Name: index.tsx (CurriculumGanttView)
 * Purpose: Main export for Gantt View tab, integrating SVAR with Bluz state.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";

import React, { useMemo } from "react";

import
{
    GanttCurriculum,
    GanttCurriculumId,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { CurriculumGanttViewInner } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/CurriculumGanttViewInner";
import { GanttDataSourceProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/types";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";
import { useCurriculumState } from "@/components/gantt/state/provider";

export type CurriculumGanttViewProps = {
    readonly curriculumId: GanttCurriculumId;
}

export function CurriculumGanttView({
    curriculumId,
}: CurriculumGanttViewProps): null | React.ReactElement
{
    const curriculum: GanttCurriculum | undefined = useCurriculum(curriculumId);
    const state = useCurriculumState();

    const innerProps: GanttDataSourceProps | null = useMemo(
        (): GanttDataSourceProps | null =>
            curriculum
                ? {
                    curriculum,
                    syllabuses: Object.values(state.syllabuses) as Array<GanttSyllabus>,
                    modules: Object.values(state.modules) as Array<GanttModule>,
                    events: Object.values(state.events) as Array<GanttEvent>,
                }
                : null,
        [ curriculum, state ],
    );

    if (!innerProps) return null;

    return (
        <GanttMappingProvider curriculumId={ curriculumId }>
            <GanttConstraintProvider context={ { curriculumId, type: 'curriculum' } }>
                <CurriculumGanttViewInner curriculumId={ curriculumId } { ...innerProps } />
            </GanttConstraintProvider>
        </GanttMappingProvider>
    );
}
