import { useDroppable } from "@dnd-kit/core";
import { useTheme } from "@mui/material/styles";
import TableRow from "@mui/material/TableRow";
import React, { memo, useMemo } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { getFlashRowSx } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/flash";
import
{
    buildDailyEventCells,
    buildWeeklyEventCells,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventCells";
import { GanttEventLabelCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventLabelCell";
import { GanttEventRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import
{
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

const GanttEventRowComponent: React.FC<GanttEventRowProps> = ({
    eventId,
    moduleId,
}) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { openEventDialog } = useCurriculumProviderActions();
    const {
        weeklyView,
        timelineWeeks,
        linearDays,
        moduleMappings,
        eventMappings,
        violations,
    } = useGanttContext();

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable(
        {
            id: `drop-remove-event-${eventId}`,
            data: { targetType: "remove", moduleId, eventId },
        },
    );

    const event = state.events[ eventId ];

    const currentDayId = eventMappings[ eventId ] || null;
    const isEventUnmapped = !currentDayId;
    const myViolations = useMemo(
        () => violations[ eventId ] || [],
        [ eventId, violations ],
    );

    const { isModuleMapped, moduleStartDayId } = useMemo(() =>
    {
        const mappedDays = moduleMappings[ moduleId ] || [];
        const dayIds = new Set<string>(mappedDays);

        const ganttModule = state.modules[ moduleId ];
        if (ganttModule && ganttModule.events)
        {
            ganttModule.events.forEach((eId) =>
            {
                if (eventMappings[ eId ]) dayIds.add(eventMappings[ eId ]);
            });
        }

        const indices = Array.from(dayIds)
            .map((id) => linearDays.indexOf(id))
            .filter((i) => i !== -1);
        const mapped = indices.length > 0;
        const startId = mapped ? linearDays[ Math.min(...indices) ] : null;

        return { isModuleMapped: mapped, moduleStartDayId: startId };
    }, [ moduleId, state.modules, moduleMappings, eventMappings, linearDays ]);

    // In weekly mode, find which week the module start falls in
    const moduleStartWeekIdx = useMemo(() =>
    {
        if (!weeklyView || !moduleStartDayId) return -1;
        return timelineWeeks.findIndex((w) =>
            w.days.includes(moduleStartDayId),
        );
    }, [ weeklyView, moduleStartDayId, timelineWeeks ]);

    const cells = useMemo(() =>
    {
        if (!event) return [];

        return weeklyView
            ? buildWeeklyEventCells({
                timelineWeeks,
                moduleId,
                eventId,
                eventTitle: event.title,
                currentDayId,
                isEventUnmapped,
                isModuleMapped,
                moduleStartWeekIdx,
                violations: myViolations,
            })
            : buildDailyEventCells({
                timelineWeeks,
                moduleId,
                eventId,
                eventTitle: event.title,
                currentDayId,
                isEventUnmapped,
                isModuleMapped,
                moduleStartDayId,
                violations: myViolations,
            });
    }, [
        event,
        weeklyView,
        timelineWeeks,
        moduleId,
        eventId,
        currentDayId,
        isEventUnmapped,
        isModuleMapped,
        moduleStartWeekIdx,
        moduleStartDayId,
        myViolations,
    ]);

    if (!event) return null;

    return (
        <TableRow
            hover
            id={ `gantt-row-event-${eventId}` }
            sx={ getFlashRowSx(theme) }
        >
            <GanttEventLabelCell
                eventId={ eventId }
                eventTitle={ event.title }
                isRemoveOver={ isRemoveOver }
                isUnmapped={ isEventUnmapped ? !isModuleMapped : null }
                moduleId={ moduleId }
                onTitleClick={ () =>
                {
                    const syllabusId = state.modules[ moduleId ]?.syllabusId;
                    if (syllabusId)
                    {
                        openEventDialog(syllabusId, moduleId, eventId);
                    }
                } }
                setRemoveNodeRef={ setRemoveNodeRef }
                violations={ myViolations }
            />

            { cells }
        </TableRow>
    );
};

export const GanttEventRow = memo(GanttEventRowComponent);
