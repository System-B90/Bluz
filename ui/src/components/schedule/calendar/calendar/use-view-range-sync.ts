"use client";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { View } from "react-big-calendar";

import { getRangeForView } from "@/components/schedule/calendar/utils";

/**
 * Two-way sync between the calendar view's date and the provider's range.
 *
 * The view owns `currentDate` and pushes its range into the context; a range
 * set from outside (a snapshot restore, #653) must move the view. Telling the
 * two apart by "is the context range inside the view's range" alone made a
 * loop: on remount (back from the gantt) the view started at today while the
 * provider still held the last viewed week, so each effect undid the other
 * every render and the grid flickered between the two weeks until a reload.
 *
 * Now the view starts from the provider's range when it has one, and an echo
 * of the range the view pushed itself is never treated as an outside change.
 */
export function useViewRangeSync({
    view,
    startDate,
    setStartDate,
    setEndDate,
}: {
    view: View;
    startDate: Date | undefined;
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;
}): [Date, Dispatch<SetStateAction<Date>>] {
    // Coming back to the page keeps the week the user was on.
    const [currentDate, setCurrentDate] = useState<Date>(() => startDate ?? new Date());
    const pushedStart = useRef<null | number>(null);

    useEffect(() => {
        const { start, end } = getRangeForView(currentDate, view);
        pushedStart.current = start.getTime();
        setStartDate(start);
        setEndDate(end);
    }, [currentDate, view, setStartDate, setEndDate]);

    useEffect(() => {
        if (!startDate) return;
        // Our own push coming back around: not an outside change.
        if (startDate.getTime() === pushedStart.current) return;
        const { start, end } = getRangeForView(currentDate, view);
        if (startDate >= start && startDate <= end) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncs view state to an external range change
        setCurrentDate(startDate);
        // Only an outside change to the context range should move the view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate]);

    return [currentDate, setCurrentDate];
}
