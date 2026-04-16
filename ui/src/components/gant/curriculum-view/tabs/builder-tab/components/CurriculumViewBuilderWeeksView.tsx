/**
 * Name: CurriculumViewBuilderWeeksView.tsx
 * Purpose: Manages the layout and expansion state of week groups.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import SyllabusModulesCurriculumViewSidebar from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules";
import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { Box, Divider } from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { Fragment } from "react/jsx-runtime";

export function CurriculumViewBuilderWeeksView({
    curriculumId,
    weeks,
    groupCount,
    weekIndexStartOffset,
    setSelectedWeekGroup,
}: {
    curriculumId: CurriculumId;
    groupCount: number;
    weeks: Array<CurriculumWeek>;
    weekIndexStartOffset: number;
    setSelectedWeekGroup: Dispatch<SetStateAction<{ start: number; length: number; }>>;
})
{
    const [ expandedGroupId, setExpandedGroupId ] = useState<string | null>(null);
    const groupedWeeks = useMemo(() => partitionWeeks(weeks, groupCount), [ weeks, groupCount ]);

    const onGroupClick = useCallback((start: number, length: number, groupKey: string) =>
    {
        setExpandedGroupId(prev => prev === groupKey ? null : groupKey);
        setSelectedWeekGroup({ start, length });
    }, [ setSelectedWeekGroup ]);

    return (
        <Box className="flex flex-row w-full h-full overflow-hidden">
            <SyllabusModulesCurriculumViewSidebar curriculumId={ curriculumId } />
            { groupedWeeks.map((group, index) =>
            {
                const isLast = index === groupedWeeks.length - 1;
                const groupKey = `group-${group[ 0 ].number}`;
                const isExpanded = expandedGroupId === groupKey;
                const isHidden = expandedGroupId !== null && !isExpanded;

                return (
                    <Fragment key={ groupKey }>
                        <WeekGroupPanel
                            group={ group }
                            allWeeks={ weeks }
                            onExpandGroup={ () => onGroupClick(group[ 0 ].number, group.length, groupKey) }
                            sx={ {
                                flex: isExpanded ? "10 0 0%" : isHidden ? "0 0 0%" : "1 1 0%",
                                opacity: isHidden ? 0 : 1,
                                minWidth: isHidden ? 0 : "300px",
                                pointerEvents: isHidden ? "none" : "auto",
                                overflow: "hidden",
                            } }
                        />
                        { !isLast && !isHidden && (
                            <Divider
                                variant="middle"
                                orientation="vertical"
                                className="h-4/5 self-center"
                            />
                        ) }
                    </Fragment>
                );
            }) }
        </Box>
    );
}
