import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GanttCurriculum, GanttWeek } from "@/api-shared/types/gantt/models";
import
{
    buildDayIndexMap,
    buildWeekIndexByDayId,
} from "@/components/gantt/curriculum-view/gantt-time-utils";

type UseGanttZoomArgs = {
    curriculum: GanttCurriculum | undefined;
    weeksById: Record<string, GanttWeek>;
}

// Days-view-only zoom affordance: restrict the grid to one week and widen its
// day columns to fill the container (#90). Extracted from UseGanttView.ts (#225).
export const useGanttZoom = ({ curriculum, weeksById }: UseGanttZoomArgs) =>
{
    const containerRef = useRef<HTMLDivElement>(null);

    const [ weeklyView, setWeeklyView ] = useState(true);
    const [ zoomedWeekId, setZoomedWeekId ] = useState<null | string>(null);
    const [ containerWidth, setContainerWidth ] = useState(0);

    const allTimelineWeeks = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.weeks
            .map((weekId) => weeksById[ weekId ])
            .filter((w) => !!w);
    }, [ curriculum, weeksById ]);

    const timelineWeeks = useMemo(() =>
    {
        if (!weeklyView && zoomedWeekId)
        {
            const zoomed = allTimelineWeeks.find((w) => w.id === zoomedWeekId);
            if (zoomed) return [ zoomed ];
        }
        return allTimelineWeeks;
    }, [ allTimelineWeeks, weeklyView, zoomedWeekId ]);

    const linearDays = useMemo(() =>
    {
        return timelineWeeks.flatMap((w) => w.days);
    }, [ timelineWeeks ]);

    const dayIndexMap = useMemo(
        () => buildDayIndexMap(linearDays),
        [ linearDays ],
    );

    const weekIndexByDayId = useMemo(
        () => buildWeekIndexByDayId(timelineWeeks),
        [ timelineWeeks ],
    );

    // When zoomed the grid holds a single week, but date labels are derived from a
    // week's absolute position, so expose that offset to the header (#90).
    const weekIndexOffset = useMemo(() =>
    {
        if (weeklyView || !zoomedWeekId) return 0;
        const idx = allTimelineWeeks.findIndex((w) => w.id === zoomedWeekId);
        return idx === -1 ? 0 : idx;
    }, [ weeklyView, zoomedWeekId, allTimelineWeeks ]);

    // Widen day columns to fill the container when a single week is zoomed (#90).
    const dayCellWidth = useMemo(() =>
    {
        const DEFAULT_WIDTH = 80;
        const LABEL_COL_WIDTH = 250;
        if (weeklyView || !zoomedWeekId) return DEFAULT_WIDTH;
        const dayCount = timelineWeeks[ 0 ]?.days.length ?? 0;
        const available = containerWidth - LABEL_COL_WIDTH;
        if (dayCount <= 0 || available <= 0) return DEFAULT_WIDTH;
        return Math.max(DEFAULT_WIDTH, Math.floor(available / dayCount));
    }, [ weeklyView, zoomedWeekId, timelineWeeks, containerWidth ]);

    // Zoom is a days-view-only affordance: drop it when returning to weekly view.
    const handleWeeklyViewChange = useCallback((checked: boolean) =>
    {
        setWeeklyView(checked);
        if (checked) setZoomedWeekId(null);
    }, []);

    // Track the scroll container width so a zoomed week can be sized to fill it (#90).
    useEffect(() =>
    {
        const node = containerRef.current;
        if (!node || typeof ResizeObserver === "undefined") return;
        setContainerWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) =>
        {
            setContainerWidth(entries[ 0 ].contentRect.width);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return {
        containerRef,
        weeklyView,
        setWeeklyView,
        handleWeeklyViewChange,
        zoomedWeekId,
        setZoomedWeekId,
        allTimelineWeeks,
        timelineWeeks,
        linearDays,
        dayIndexMap,
        weekIndexByDayId,
        weekIndexOffset,
        dayCellWidth,
        singleWeekDayZoom: !weeklyView && zoomedWeekId !== null,
    };
};
