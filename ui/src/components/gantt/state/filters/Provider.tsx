"use client";
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import {
    EMPTY_GANTT_FILTERS,
    GANTT_FILTER_DEFINITIONS,
    GanttFilterKey,
    GanttFilterValues,
} from "@/components/gantt/state/filters/definitions";

export type GanttFiltersContextState = {
    values: GanttFilterValues;
    setFilter: <K extends GanttFilterKey>(key: K, value: GanttFilterValues[K]) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
    /** Passes when every active filter matches (AND). */
    syllabusMatches: (syllabus: GanttSyllabus) => boolean;
    /** Human-readable summary of the active filters, empty when none. */
    description: string;
};

const GanttFiltersContext = createContext<GanttFiltersContextState | null>(null);

export function GanttFiltersProvider({ children }: { children: ReactNode }) {
    const [values, setValues] = useState<GanttFilterValues>(EMPTY_GANTT_FILTERS);
    const { getCourse } = useCourses();
    const { getInstructor } = useHiveUsers();

    const setFilter = useCallback(
        <K extends GanttFilterKey>(key: K, value: GanttFilterValues[K]) =>
            setValues((prev) => ({ ...prev, [key]: value })),
        [],
    );
    const clearFilters = useCallback(() => setValues(EMPTY_GANTT_FILTERS), []);

    const active = useMemo(
        () => GANTT_FILTER_DEFINITIONS.filter((def) => def.isActive(values[def.key])),
        [values],
    );

    const syllabusMatches = useCallback(
        (syllabus: GanttSyllabus) =>
            active.every((def) => def.matches(syllabus, values[def.key])),
        [active, values],
    );

    const description = useMemo(() => {
        if (active.length === 0) return "";
        const parts = active.map((def) =>
            def.describe(values[def.key], { getCourse, getInstructor }),
        );
        return `מוצגים רק מקצועות ש${parts.join(" וגם ש")}.`;
    }, [active, values, getCourse, getInstructor]);

    const contextValue = useMemo(
        () => ({
            values,
            setFilter,
            clearFilters,
            hasActiveFilters: active.length > 0,
            syllabusMatches,
            description,
        }),
        [values, setFilter, clearFilters, active.length, syllabusMatches, description],
    );

    return (
        <GanttFiltersContext.Provider value={contextValue}>
            {children}
        </GanttFiltersContext.Provider>
    );
}

export function useGanttFilters(): GanttFiltersContextState {
    const context = useContext(GanttFiltersContext);
    if (!context) {
        throw new Error("useGanttFilters must be used within a GanttFiltersProvider");
    }
    return context;
}
