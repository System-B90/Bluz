/**
 * Name: CurriculumViewBuilderWeeksView.tsx
 * Purpose: Manages the layout and expansion state of week groups with fixed collapse.
 * Created: 2026-04-16
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
        // Toggle expansion
        setExpandedGroupId(prev => (prev === groupKey ? null : groupKey));
        setSelectedWeekGroup({ start, length });
    }, [ setSelectedWeekGroup ]);

    return (
        <Box className="flex flex-row w-full h-full overflow-hidden items-stretch">
            <SyllabusModulesCurriculumViewSidebar curriculumId={ curriculumId } />

            { groupedWeeks.map((group, index) =>
            {
                const isLast = index === groupedWeeks.length - 1;
                const groupKey = `group-${group[ 0 ].number}`;
                const isExpanded = expandedGroupId === groupKey;
                const isAnyExpanded = expandedGroupId !== null;
                const isHidden = isAnyExpanded && !isExpanded;

                return (
                    <Fragment key={ groupKey }>
                        <WeekGroupPanel
                            group={ group }
                            allWeeks={ weeks }
                            onExpandGroup={ () => onGroupClick(group[ 0 ].number, group.length, groupKey) }
                            sx={ {
                                // If this is expanded, grow to fill. If another is expanded, shrink to 0.
                                // Otherwise, distribute equally.
                                flex: isExpanded ? "1 0 100%" : isHidden ? "0 0 0%" : "1 1 0%",
                                visibility: isHidden ? "hidden" : "visible",
                                opacity: isHidden ? 0 : 1,
                                minWidth: isHidden ? 0 : "300px",
                                padding: isHidden ? 0 : undefined,
                                overflow: "hidden",
                                transition: (theme) => theme.transitions.create([ 'flex', 'opacity', 'min-width', 'padding' ], {
                                    duration: theme.transitions.duration.standard,
                                }),
                            } }
                        />
                        { !isLast && !isHidden && !isExpanded && (
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
