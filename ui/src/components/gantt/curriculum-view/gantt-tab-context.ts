"use client";
import { createContext, useCallback, useContext } from "react";

export type GanttTabControl = {
    selectedTabIndex: number;
    setSelectedTabIndex: (index: number) => void;
};

/**
 * The selected gantt tab, for code inside a tab that must act on its own tab.
 * Visited tabs stay mounted while hidden (#326), so anything they register
 * (palette commands) outlives the switch away from them.
 */
export const GanttTabContext = createContext<GanttTabControl | null>(null);

/**
 * A callback that selects `tabIndex` unless it already is. A no-op outside a
 * `GanttTabContext`.
 */
export function useShowGanttTab(tabIndex: number): () => void
{
    const control = useContext(GanttTabContext);
    const selectedTabIndex = control?.selectedTabIndex;
    const setSelectedTabIndex = control?.setSelectedTabIndex;

    return useCallback(() =>
    {
        if (setSelectedTabIndex && selectedTabIndex !== tabIndex) setSelectedTabIndex(tabIndex);
    }, [ selectedTabIndex, setSelectedTabIndex, tabIndex ]);
}
