/**
 * Name: WeekGroupPanel.tsx
 * Purpose: A droppable container for modules with animated expansion and distinct interaction zones.
 * Created: 2026-04-16
 * Author: Michael K. Steinberg
 */

import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { useCurriculumMappings } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import GroupHeader from "@/components/gant/curriculum-view/tabs/builder-tab/components/GroupHeader";
import { ModuleItem } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { calculateTotalWorkingTimeForWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import { useDroppable } from "@dnd-kit/core";
import { Box, BoxProps, Collapse, Divider } from "@mui/material";
import { useMemo, useState } from "react";

export interface WeekGroupPanelProps extends BoxProps
{
    group: Array<CurriculumWeek>;
    allWeeks: Array<CurriculumWeek>;
    onExpandGroup: () => void; // This acts as the "Select/Focus" callback
}

export default function WeekGroupPanel({
    group,
    allWeeks,
    onExpandGroup,
    ...props
}: WeekGroupPanelProps)
{
    const [ isExpanded, setIsExpanded ] = useState(true);
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

    const handleToggle = (e: React.MouseEvent) =>
    {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <Box
            { ...props }
            ref={ setNodeRef }
            className={ `
                flex flex-col p-4 min-w-85 transition-all duration-300 border-2 rounded-xl
                ${isOver ? "bg-blue-50 border-blue-400 scale-[1.02] shadow-lg" : "bg-white border-gray-100 hover:border-gray-300 shadow-sm"}
            `}
        >
            <GroupHeader
                start={ startWeek }
                end={ endWeek }
                totalHours={ totalTime }
                isExpanded={ isExpanded }
                onToggleExpand={ handleToggle }
                onSelectGroup={ onExpandGroup }
            />

            <Collapse in={ isExpanded } timeout={ 300 } unmountOnExit>
                <Box className="mt-4">
                    <Divider className="mb-4" />
                    <Box className={ `flex flex-col gap-2 min-h-20 rounded-lg` }>
                        { moduleItems }
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}
