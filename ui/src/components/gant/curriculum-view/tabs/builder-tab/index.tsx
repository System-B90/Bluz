/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculum } from "@/components/gant/state/hooks";
import { Box, BoxProps, Divider, Typography } from "@mui/material";
import React, { useMemo } from "react";

export interface CurriculumViewBuilderTabProps extends BoxProps
{
    curriculumId: string;
}

export interface WeekGroupPanelProps extends BoxProps
{
    group: CurriculumWeek[];
    allWeeks: CurriculumWeek[];
}

export interface GroupHeaderProps extends BoxProps
{
    start: number;
    end: number;
    totalHours: number;
}

/**
 * Partitions the weeks into N groups as balanced as possible.
 */
function partitionWeeks(weeks: CurriculumWeek[], groupCount: number): CurriculumWeek[][]
{
    const totalWeeks = weeks.length;
    if (totalWeeks === 0) return [];

    const baseSize = Math.floor(totalWeeks / groupCount);
    const remainder = totalWeeks % groupCount;

    let currentIndex = 0;
    return Array.from({ length: groupCount }, (_, i) =>
    {
        const size = baseSize + (i < remainder ? 1 : 0);
        const group = weeks.slice(currentIndex, currentIndex + size);
        currentIndex += size;
        return group;
    }).filter((group) => group.length > 0);
}

function calculateTotalWorkingTimeForWeeks(weeks: CurriculumWeek[]): number
{
    return weeks.reduce(
        (total, week) =>
            total + week.days.reduce((weekTotal, day) => weekTotal + day.totalWorkingHours, 0),
        0
    );
}

function GroupHeader({ start, end, totalHours, ...props }: GroupHeaderProps)
{
    return (
        <Box { ...props } className="flex items-center justify-between mb-4">
            <Typography variant="h6" fontWeight="bold">
                שבועות { start } - { end }
            </Typography>
            <WorkTimeChip totalHours={ totalHours } />
        </Box>
    );
}

function WeekGroupPanel({ group, allWeeks, ...props }: WeekGroupPanelProps)
{
    const startWeek = allWeeks.indexOf(group[ 0 ]) + 1;
    const endWeek = allWeeks.indexOf(group[ group.length - 1 ]) + 1;

    const totalTime = useMemo(
        () => calculateTotalWorkingTimeForWeeks(group),
        [ group ]
    );

    return (
        <Box
            { ...props }
            className="flex flex-1 flex-col p-4 min-w-75 gap-4"
        >
            <GroupHeader start={ startWeek } end={ endWeek } totalHours={ totalTime } />
            <Divider />
            <Box className="flex flex-col gap-2">
                {/** Keep this empty for now */ }
            </Box>
        </Box>
    );
}

export default function CurriculumViewBuilderTab({
    curriculumId,
    ...props
}: CurriculumViewBuilderTabProps)
{
    const weeks = useCurriculum(curriculumId)?.weeks ?? [];
    const groupCount = 3;

    const groupedWeeks = useMemo(() => partitionWeeks(weeks, groupCount), [ weeks, groupCount ]);

    return (
        <Box
            { ...props }
            className="flex flex-row grow h-full gap-2"
        >
            { groupedWeeks.map((group, index) =>
            {
                const isLast = index === groupedWeeks.length - 1;
                const groupKey = `group-${group[ 0 ]?.number ?? index}`;

                return (
                    <React.Fragment key={ groupKey }>
                        <WeekGroupPanel group={ group } allWeeks={ weeks } />
                        { !isLast && (
                            <Divider
                                variant="middle"
                                orientation="vertical"
                                className="h-4/5 self-center"
                            />
                        ) }
                    </React.Fragment>
                );
            }) }
        </Box>
    );
}
