import { Box, BoxProps } from "@mui/material";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
import { CreateSyllabusButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import { SyllabusSelectionField } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/SyllabusSelectionField";

export interface SyllabusesActionsBoxProps extends Omit<
  BoxProps,
  "display" | "justifyContent"
> {
  curriculumId: GanttCurriculumId;
}

export function SyllabusesActionsBox({
  curriculumId,
  ...props
}: SyllabusesActionsBoxProps) {
  return (
    <Box display="flex" gap={2} justifyContent="flex-start" {...props}>
      <CreateSyllabusButton curriculumId={curriculumId} />
      <SyllabusSelectionField
        alignItems={"center"}
        className="w-100"
        curriculumId={curriculumId}
        display="flex"
        flexDirection="row"
        gap={1}
      />
    </Box>
  );
}
