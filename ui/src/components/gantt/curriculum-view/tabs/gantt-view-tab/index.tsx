/**
 * Name: index.tsx (CurriculumGanttView)
 * Purpose: Main export for Gantt View tab, integrating Gantt with Bluz state.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";
import React from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumGanttViewInner } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/CurriculumGanttViewInner";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";

export type CurriculumGanttViewProps = {
    readonly curriculumId: GanttCurriculumId;
};

export function CurriculumGanttView({
    curriculumId,
}: CurriculumGanttViewProps): null | React.ReactElement {
    const curriculum = useCurriculum(curriculumId);

    if (!curriculum) return null;

    return (
        <GanttMappingProvider curriculumId={curriculumId}>
            <GanttConstraintProvider
                context={{ curriculumId, type: "curriculum" }}
            >
                <CurriculumGanttViewInner curriculumId={curriculumId} />
            </GanttConstraintProvider>
        </GanttMappingProvider>
    );
}
