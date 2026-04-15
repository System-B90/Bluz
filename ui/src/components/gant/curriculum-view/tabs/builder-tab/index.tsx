/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { useCurriculum } from "@/components/gant/state/hooks";
import { Box, BoxProps, Divider } from "@mui/material";
import React, { useMemo } from "react";

export interface CurriculumViewBuilderTabProps extends BoxProps
{
    curriculumId: string;
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
