import { Dispatch, SetStateAction } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { AboutTimeCurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars/about-time";

export function CurriculumViewSidebar({
    selectedTabIndex,
    curriculumId,
    setCurrentCurriculum,
    onCreate, onDelete,
}: {
    selectedTabIndex: number;
    curriculumId: GanttCurriculumId | null;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
} & GanttCreationDeletionCallbackProps)
{
    return (
        (selectedTabIndex >= 0 && selectedTabIndex <= 1 && (
            <AboutTimeCurriculumViewSidebar
                curriculumId={ curriculumId }
                onCreate={ onCreate }
                onDelete={ onDelete }
                setCurrentCurriculum={ setCurrentCurriculum } />
        )) || <></>
    );
}
