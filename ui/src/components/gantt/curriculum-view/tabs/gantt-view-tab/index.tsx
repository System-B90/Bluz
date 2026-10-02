"use client";
import React, { useMemo } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view";
import { GanttViewProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";
import { GanttRecurrenceExceptionProvider } from "@/components/gantt/state/recurrence-exceptions/Provider";

/**
 * Properties for the {@link CurriculumGanttView} component.
 */
export type CurriculumGanttViewProps = {
    /** The unique identifier of the Gantt curriculum. */
    readonly curriculumId: GanttCurriculumId;
    /** The view rendered inside the providers; the timeline by default. */
    readonly View?: React.FC<GanttViewProps>;
};

/**
 * Main export component for the Gantt View tab, integrating the Gantt chart with Bluz state providers.
 * 
 * @param props - Component props containing the curriculumId.
 * @returns The rendered React element, or null if the curriculum is not loaded.
 */
export function CurriculumGanttView({
    curriculumId,
    View = GanttView,
}: CurriculumGanttViewProps): null | React.ReactElement {
    const curriculum = useCurriculum(curriculumId);
    // Stable identity: GanttConstraintProvider refetches whenever this
    // changes, and an inline literal changes on every render.
    const constraintContext = useMemo(
        () => ({ curriculumId, type: "curriculum" }) as const,
        [curriculumId],
    );

    if (!curriculum) return null;

    return (
        <GanttMappingProvider curriculumId={curriculumId}>
            <GanttRecurrenceExceptionProvider curriculumId={curriculumId}>
                <GanttConstraintProvider context={constraintContext}>
                    <View curriculumId={curriculumId} />
                </GanttConstraintProvider>
            </GanttRecurrenceExceptionProvider>
        </GanttMappingProvider>
    );
}
