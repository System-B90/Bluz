import { Box } from "@mui/material";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumAboutCard } from "@/components/gantt/curriculum-view/components/curriculum-about-card";
import { HoursCard } from "@/components/gantt/curriculum-view/components/HoursCard";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";

export function AboutTimeCurriculumViewSidebar({
    curriculumId,
}: {
  curriculumId: GanttCurriculumId | null;
}) {
    const curriculum = useCurriculum(curriculumId ?? "");

    return (
        <Box
            display={"flex"}
            flexDirection={"column"}
            flexGrow={1}
            flexShrink={0}
            flexWrap={"nowrap"}
            gap={2}
            height={"100%"}
            overflow={"hidden"}
            pb={1}
            px={1}
        >
            <CurriculumAboutCard
                curriculum={curriculum}
                curriculumId={curriculumId}
            />
            <HoursCard curriculum={curriculum} />
        </Box>
    );
}
