"use client";
import React from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumGanttViewInner } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/CurriculumGanttViewInner";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";

/**
 * Properties for the {@link CurriculumGanttView} component.
 */
export type CurriculumGanttViewProps = {
    /** The unique identifier of the Gantt curriculum. */
    readonly curriculumId: GanttCurriculumId;
};

/**
 * Main export component for the Gantt View tab, integrating the Gantt chart with Bluz state providers.
 * 
 * @param props - Component props containing the curriculumId.
 * @returns The rendered React element, or null if the curriculum is not loaded.
 */
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
