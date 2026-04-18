/**
* Name: WeekGroupPanel.tsx
* Purpose: A droppable container for modules within a specific week group.
* Created: 2026-04-15
* Author: Michael K. Steinberg
*/

import { useDroppable } from "@dnd-kit/core";
import { Box, BoxProps, Divider } from "@mui/material";
import { useMemo } from "react";

import { GanttWeekId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumMappings } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { GroupHeader } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/GroupHeader";
import { ModuleItem } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { calculateTotalWorkingTimeForWeeks } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/utils";
import { useCurriculumState } from "@/components/gantt/state/provider";

export interface WeekGroupPanelProps extends BoxProps
{
    group: Array<GanttWeekId>;
    onExpandGroup: () => void;
}

export function WeekGroupPanel({
    group,
    onExpandGroup,
    flexShrink,
    ...props
}: WeekGroupPanelProps)
{
    const { state: { mappings } } = useCurriculumMappings();
    const state = useCurriculumState();

    const weeksState = useMemo(() => state.weeks, [ state.weeks ]);

    const startWeek = useMemo(() =>
    {
        const firstWeekId = group[ 0 ];
        const week = weeksState[ firstWeekId ];
        return week?.number ?? 1;
    }, [ group, weeksState ]);

    const endWeek = useMemo(() =>
    {
        const lastWeekId = group[ group.length - 1 ];
        const week = weeksState[ lastWeekId ];
        return week?.number ?? group.length;
    }, [ group, weeksState ]);
    const dropId = `weeks-${startWeek}-${endWeek}`;

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: {
            type: "WEEK_GROUP",
            weeks: group.map((weekId) => weeksState[ weekId ]?.number ?? 0).filter(n => n > 0),
            weekIndex: startWeek - 1,
            dayIndex: 0,
        },
    });
    const totalTime = useMemo(() => calculateTotalWorkingTimeForWeeks(group, state), [ group, state ]);

    const dayIds = useMemo(() => group.flatMap((weekId) => weeksState[ weekId ]).flatMap((ganttWeek) => ganttWeek.days), [ weeksState, group ]);

    const moduleItems = useMemo(() =>
    {
        return Object.values(mappings)
            .filter((x) => dayIds.includes(x.dayId))
            .map((x) => (
                <ModuleItem dayId={ x.dayId } key={ x.moduleId } moduleId={ x.moduleId } />
            ));
    }, [ mappings, dayIds ]);

    return (
        <Box
            { ...props }
            className={ `
               flex flex-col py-4 ${flexShrink === 1 ? 'px-0' : 'px-4'} min-w-0 gap-4 transition-all duration-200 border-2 border-transparent
               overflow-hidden
               ${isOver ? "bg-blue-50/50 border-dashed border-blue-300 scale-[1.01]" : "bg-transparent"}
            `}
            ref={ setNodeRef }
        >
            <GroupHeader end={ endWeek } onExpandGroup={ onExpandGroup } start={ startWeek } totalHours={ totalTime } />
            <Divider />
            <Box
                className={ `
                    flex flex-col gap-2 grow min-h-25 rounded-lg
                    ${isOver ? "ring-2 ring-blue-100 ring-inset" : ""}
               ` }
            >
                { moduleItems }
            </Box>
        </Box>
    );

}
