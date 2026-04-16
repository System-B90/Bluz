/**
* Name: WeekGroupPanel.tsx
* Purpose: A droppable container for modules within a specific week group.
* Created: 2026-04-15
* Author: Michael K. Steinberg
*/

import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { useCurriculumMappings } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import GroupHeader from "@/components/gant/curriculum-view/tabs/builder-tab/components/GroupHeader";
import { ModuleItem } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { calculateTotalWorkingTimeForWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import { useDroppable } from "@dnd-kit/core";
import { Box, BoxProps, Divider } from "@mui/material";
import { useMemo } from "react";

export interface WeekGroupPanelProps extends BoxProps
{
    group: Array<CurriculumWeek>;
    allWeeks: Array<CurriculumWeek>;
    onExpandGroup: () => void;
}

export default function WeekGroupPanel({
    group,
    allWeeks,
    onExpandGroup,
    flexShrink,
    ...props
}: WeekGroupPanelProps)
{
    const { state: { mappings } } = useCurriculumMappings();

    const startWeek = allWeeks.indexOf(group[ 0 ]) + 1;
    const endWeek = allWeeks.indexOf(group[ group.length - 1 ]) + 1;
    const dropId = `weeks-${startWeek}-${endWeek}`;

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: {
            type: "WEEK_GROUP",
            weeks: group.map((w) => w.number),
            weekIndex: startWeek - 1,
            dayIndex: 0,
        },
    });
    const totalTime = useMemo(() => calculateTotalWorkingTimeForWeeks(group), [ group ]);
    const moduleItems = useMemo(() =>
        Object.values(mappings)
            .filter((x) => group.includes(allWeeks[ x.weekIndex ]))
            .map((x) => (
                <ModuleItem key={ x.moduleId } moduleId={ x.moduleId } weekIndex={ x.weekIndex } dayIndex={ x.dayIndex } />
            )), [ mappings, group, allWeeks ]);

    return (
        <Box
            { ...props }
            ref={ setNodeRef }
            className={ `
               flex flex-col py-4 ${flexShrink === 1 ? 'px-0' : 'px-4'} min-w-0 gap-4 transition-all duration-200 border-2 border-transparent
               overflow-hidden
               ${isOver ? "bg-blue-50/50 border-dashed border-blue-300 scale-[1.01]" : "bg-transparent"}
            `}
        >
            <GroupHeader start={ startWeek } end={ endWeek } totalHours={ totalTime } onExpandGroup={ onExpandGroup } />
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