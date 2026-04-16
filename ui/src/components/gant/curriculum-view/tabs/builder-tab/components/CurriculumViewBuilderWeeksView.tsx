import { Divider } from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { Fragment } from "react/jsx-runtime";

import { CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import SyllabusModulesCurriculumViewSidebar from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules";
import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";

export function CurriculumViewBuilderWeeksView({
    curriculumId,
    weeks,
    groupCount,
    setSelectedWeekGroup,
}: {
    curriculumId: CurriculumId;
    groupCount: number;
    weeks: Array<CurriculumWeek>;
    setSelectedWeekGroup: Dispatch<SetStateAction<{ start: number; length: number; }>>;
})
{
    const [ animationSelectedGroupIndex, setAnimationSelectedGroupIndex ] = useState<null | number>(null);
    const groupedWeeks = useMemo(() => partitionWeeks(weeks, groupCount), [ weeks, groupCount ]);
    const onGroupClick = useCallback((groupIndex: number, start: number, length: number) =>
    {
        console.log(start, length);
        setAnimationSelectedGroupIndex(groupIndex);
        setTimeout(() =>
        {
            setSelectedWeekGroup({ start, length });
            setAnimationSelectedGroupIndex(null);
        }, 400);
    }, [ setSelectedWeekGroup ]);

    const weekGroupPanels = useMemo(() => groupedWeeks.map((group, index) =>
    {
        const isLast = index === groupedWeeks.length - 1;
        const groupKey = `group-${group[ 0 ].number}-${group[ group.length - 1 ].number}`;

        return (
            <Fragment key={ `frag-${groupKey}` }>
                <WeekGroupPanel
                    flexBasis={ 0 }
                    flexGrow={ animationSelectedGroupIndex === null ? 1 : (animationSelectedGroupIndex === index ? 1 : 0) }
                    flexShrink={ animationSelectedGroupIndex === null ? undefined : (animationSelectedGroupIndex === index ? 0 : 1) }
                    group={ group }
                    key={ groupKey }
                    onExpandGroup={ () => onGroupClick(index, group[ 0 ].number - 1, group.length) }
                />
                { !isLast && (
                    <Divider
                        className="h-4/5 self-center"
                        orientation="vertical"
                        variant="middle"
                    />
                ) }
            </Fragment>
        );
    }), [ animationSelectedGroupIndex, groupedWeeks, onGroupClick ]);

    return (
        <Fragment>
            <SyllabusModulesCurriculumViewSidebar curriculumId={ curriculumId } />
            { weekGroupPanels }
        </Fragment>
    );
}
