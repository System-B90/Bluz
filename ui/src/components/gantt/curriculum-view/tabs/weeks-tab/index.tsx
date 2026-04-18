/**
 * Name: WeeksTab.tsx
 * Purpose: Container for horizontal scrolling week panels in Bluz.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { Box } from "@mui/material";
import { useMemo } from "react";

import {
  GanttCurriculumId,
  GanttWeekId,
} from "@/api-shared/types/gantt/models/curriculum";
import { WeekPanel } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";

export function WeeksTab({
  curriculumId,
}: {
  curriculumId: GanttCurriculumId;
}) {
  const curriculum = useCurriculum(curriculumId ?? "");

  const renderedPanels = useMemo(
    () =>
      (curriculum?.weeks || []).map((weekId: GanttWeekId) => (
        <WeekPanel curriculumId={curriculumId} key={weekId} weekId={weekId} />
      )),
    [curriculum?.weeks, curriculumId],
  );

  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      flexGrow={1}
      gap={2}
      height={"100%"}
    >
      <Box
        display="flex"
        flexDirection="column"
        gap={1}
        height={"100%"}
        width={"100%"}
      >
        <Box
          alignContent={"flex-start"}
          display={"flex"}
          flexDirection={"column"}
          flexWrap={"wrap"}
          gap={2}
          height={"100%"}
          sx={{ overflowX: "scroll" }}
        >
          {renderedPanels}
        </Box>
      </Box>
    </Box>
  );
}
