import { ButtonProps } from "@mui/material/Button";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";

export type BaseActionItemProps = {
    onProcessingChange: (isProcessing: boolean) => void;
    loading?: boolean;
} & Omit<ButtonProps, "children" | "onClick">;

export type CurriculumAwareActionItemProps = {
    sourceCurriculum?: GanttCurriculumDocument | null;
} & BaseActionItemProps;
