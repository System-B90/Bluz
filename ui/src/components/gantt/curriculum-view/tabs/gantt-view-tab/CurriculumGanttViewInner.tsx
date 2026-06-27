"use client";

import React from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view";

/**
 * Inner component that handles Gantt rendering with data transformation.
 * 
 * @param props - Component props containing the curriculumId.
 * @returns The rendered React element.
 */
export function CurriculumGanttViewInner({
    curriculumId,
}: {
    curriculumId: GanttCurriculumId;
}): React.ReactElement {
    return <GanttView curriculumId={curriculumId} />;
}
