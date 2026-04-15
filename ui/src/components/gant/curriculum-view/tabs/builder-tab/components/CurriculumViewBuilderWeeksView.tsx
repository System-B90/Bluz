import { CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import SyllabusModulesCurriculumViewSidebar from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules";
import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { Divider } from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
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
    const groupedWeeks = useMemo(() => partitionWeeks(weeks, groupCount), [ weeks, groupCount ]);

    const onGroupClick = useCallback((start: number, length: number) =>
    {
        setSelectedWeekGroup({ start, length });
    }, [ setSelectedWeekGroup ]);

    return (
        <Fragment>
            <SyllabusModulesCurriculumViewSidebar curriculumId={ curriculumId } />
            { groupedWeeks.map((group, index) =>
            {
                const isLast = index === groupedWeeks.length - 1;
                const groupKey = `group-${group[ 0 ].number}`;

                return (
                    <Fragment key={ groupKey }>
                        <WeekGroupPanel group={ group } allWeeks={ weeks } onExpandGroup={ () => onGroupClick(group[ 0 ].number, group.length) } />
                        { !isLast && (
                            <Divider
                                variant="middle"
                                orientation="vertical"
                                className="h-4/5 self-center"
                            />
                        ) }
                    </Fragment>
                );
            }) }
        </Fragment>
    );
}
