import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";

export type DuplicateCurriculumActionProps = {
  onCreate: (newCurriculum: GanttCurriculumDocument) => void;
} & CurriculumAwareActionItemProps;

export function DuplicateCurriculumAction({
    sourceCurriculum,
    onCreate,
    onProcessingChange,
    ...props
}: DuplicateCurriculumActionProps) {
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        const payload: Omit<CreateGanttCurriculumPayload, "weeks"> & {
      weeks: typeof sourceCurriculum.weeks;
    } = {
        title: `${sourceCurriculum.title} (Copy)`,
        description: sourceCurriculum.description,
        isDraft: true,
        weeks: sourceCurriculum.weeks,
    };
        // Cast to proper type - duplication uses the same week IDs structure
        ganttApi.curriculum
            .apiCreate(payload as CreateGanttCurriculumPayload)
            .then((newCurriculum) => onCreate(newCurriculum))
            .catch((error: unknown) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "שכפול הגאנט נכשל!", error),
            )
            .finally(() => onProcessingChange(false));
    }, [enqueueSnackbar, onCreate, onProcessingChange, sourceCurriculum]);

    return (
        <ActionItemButton
            onClick={clickHandler}
            startIcon={<ContentCopyIcon fontSize="small" />}
            {...props}
        >
      שכפול
        </ActionItemButton>
    );
}
