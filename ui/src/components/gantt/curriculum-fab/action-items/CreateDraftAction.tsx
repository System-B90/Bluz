import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { makeCurriculum } from "@/api-shared/types/gantt/maker";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { BaseActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";

export type CreateDraftActionProps = {
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
} & BaseActionItemProps;

export function CreateDraftAction({
    onCreate,
    onProcessingChange,
    ...props
}: CreateDraftActionProps) {
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() => {
        onProcessingChange(true);
        ganttApi.curriculum
            .apiCreate(makeCurriculum())
            .then((newCurriculum) => onCreate(newCurriculum))
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "יצירת הגאנט נשלכה!",
                    error,
                ),
            )
            .finally(() => onProcessingChange(false));
    }, [enqueueSnackbar, onCreate, onProcessingChange]);

    return (
        <ActionItemButton
            onClick={clickHandler}
            startIcon={<AddCircleOutlineIcon fontSize="small" />}
            tooltipTitle="דראפט חדש"
            {...props}
        />
    );
}
