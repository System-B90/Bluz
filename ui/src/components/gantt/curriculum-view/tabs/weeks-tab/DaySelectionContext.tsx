"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";

import { GanttDayId } from "@/api-shared/types/gantt/models";

type DaySelectionState = {
    selectedDayIds: ReadonlySet<GanttDayId>;
    /**
     * Shift-click on a day cell. The first one anchors the selection; each
     * later one extends it to the whole run between the anchor and that day in
     * calendar order, so a range can cross weeks (#476). Shift-clicking the
     * anchor itself clears the selection.
     */
    extendTo: (dayId: GanttDayId) => void;
    clear: () => void;
};

const DaySelectionContext = createContext<DaySelectionState>({
    selectedDayIds: new Set<GanttDayId>(),
    extendTo: () => {},
    clear: () => {},
});

/**
 * Selection state for the weeks grid's day cells. Lives above the rows so a
 * range can span weeks, and holds nothing but ids — the cells stay the owners
 * of their own values.
 *
 * @param orderedDayIds Every day in the grid, in calendar order. Range
 *   selection is defined over this order, so it must match what is rendered.
 */
export function DaySelectionProvider({
    children,
    orderedDayIds,
}: {
    children: React.ReactNode;
    orderedDayIds: Array<GanttDayId>;
}) {
    const [selectedDayIds, setSelectedDayIds] = useState<ReadonlySet<GanttDayId>>(
        new Set<GanttDayId>(),
    );
    const anchorRef = useRef<GanttDayId | null>(null);

    const clear = useCallback(() => {
        anchorRef.current = null;
        setSelectedDayIds(new Set<GanttDayId>());
    }, []);

    const extendTo = useCallback(
        (dayId: GanttDayId) => {
            const anchor = anchorRef.current;
            if (anchor === null || anchor === dayId) {
                const isReclick = anchor === dayId;
                anchorRef.current = isReclick ? null : dayId;
                setSelectedDayIds(
                    isReclick ? new Set<GanttDayId>() : new Set([dayId]),
                );
                return;
            }

            const from = orderedDayIds.indexOf(anchor);
            const to = orderedDayIds.indexOf(dayId);
            if (from === -1 || to === -1) {
                // The anchor scrolled out of the curriculum (a week was
                // deleted); restart the range from the clicked day.
                anchorRef.current = dayId;
                setSelectedDayIds(new Set([dayId]));
                return;
            }

            const [start, end] = from <= to ? [from, to] : [to, from];
            setSelectedDayIds(new Set(orderedDayIds.slice(start, end + 1)));
        },
        [orderedDayIds],
    );

    const value = useMemo(
        () => ({ clear, extendTo, selectedDayIds }),
        [clear, extendTo, selectedDayIds],
    );

    return (
        <DaySelectionContext.Provider value={value}>
            {children}
        </DaySelectionContext.Provider>
    );
}

export function useDaySelection(): DaySelectionState {
    return useContext(DaySelectionContext);
}
