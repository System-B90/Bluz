import { ButtonProps } from "@mui/material/Button";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";

export type BaseActionItemProps = {
    onProcessingChange: (isProcessing: boolean) => void;
} & Omit<ButtonProps, "children">;

export type CurriculumAwareActionItemProps = {
    sourceCurriculum?: GanttCurriculumDocument | null;
} & BaseActionItemProps;
