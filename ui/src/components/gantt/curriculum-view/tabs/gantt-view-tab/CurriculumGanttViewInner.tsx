/**
 * Name: CurriculumGanttViewInner.tsx
 * Purpose: Inner component that renders the Gantt chart with interaction handling.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";

import React from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view";

/**
 * Inner component that handles Gantt rendering with data transformation
 */
export function CurriculumGanttViewInner(
    { curriculumId }: { curriculumId: GanttCurriculumId; }
): React.ReactElement
{
    return (
        <GanttView
            curriculumId={ curriculumId }
        />
    );
}
