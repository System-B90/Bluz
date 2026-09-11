import Box from "@mui/material/Box";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GANTT_ANCHORS } from "@/components/app-onboarding/anchors";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculumAboutCard } from "@/components/gantt/curriculum-view/components/curriculum-about-card";
import { HoursCard } from "@/components/gantt/curriculum-view/components/HoursCard";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useTourAnchor } from "@/components/onboarding";
import { Dispatch, SetStateAction } from "react";

export function AboutTimeCurriculumViewSidebar({
    curriculumId,
    setCurrentCurriculum,
    onCreate, onDelete,
}: {
    curriculumId: GanttCurriculumId | null;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
} & GanttCreationDeletionCallbackProps)
{
    const curriculum = useCurriculum(curriculumId ?? "");
    const sidebarAnchor = useTourAnchor<HTMLDivElement>(GANTT_ANCHORS.sidebar);

    return (
        <Box
            display={ "flex" }
            flexDirection={ "column" }
            flexGrow={ 1 }
            flexShrink={ 0 }
            flexWrap={ "nowrap" }
            gap={ 2 }
            height={ "100%" }
            overflow={ "hidden" }
            pb={ 1 }
            px={ 1 }
            ref={ sidebarAnchor }
        >
            <CurriculumAboutCard
                curriculum={ curriculum }
                curriculumId={ curriculumId }
                setCurrentCurriculum={ setCurrentCurriculum }
                onCreate={ onCreate }
                onDelete={ onDelete }
            />
            <HoursCard curriculum={ curriculum } />
        </Box>
    );
}
