"use client";
import { Dispatch, SetStateAction } from "react";

import { useGanttHelpTopics } from "@/components/app-onboarding/gantt/use-gantt-help-topics";
import { useGanttTour } from "@/components/app-onboarding/gantt/use-gantt-tour";

/**
 * Registers the gantt screen's tour and help topics for exactly as long as the
 * screen is mounted.
 *
 * Rendered from `CurriculumView`, which owns the tab state the tour drives —
 * the same pattern as `GanttContentCommands` and the command palette.
 */
export function GanttOnboarding({
    setSelectedTabIndex,
}: {
    setSelectedTabIndex: Dispatch<SetStateAction<number>>;
}) {
    useGanttTour(setSelectedTabIndex);
    useGanttHelpTopics();

    return null;
}
