/**
 * Name: CurriculumGanttViewInner.tsx
 * Purpose: Inner component that renders the Gantt chart with interaction handling.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";

import React from "react";

import { useCurriculumMappings } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { GanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/GanttView";
import
    {
        GanttDataSourceProps
    } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/types";
import { useCurriculumState } from "@/components/gantt/state/provider";

/**
 * Inner component that handles Gantt rendering with data transformation
 */
export function CurriculumGanttViewInner(
    props: GanttDataSourceProps,
): React.ReactElement
{
    const state = useCurriculumState();
    const { state: { mappings } } = useCurriculumMappings();
    return (
        <GanttView
            weeks={ new Map(Object.entries(state.weeks)) }
            days={ new Map(Object.entries(state.days)) }
            syllabuses={ new Map(Object.entries(state.syllabuses)) }
            curriculum={ props.curriculum }
            modules={ new Map(Object.entries(state.modules)) }
            mappings={ Object.values(mappings) }
        />
    );
}
