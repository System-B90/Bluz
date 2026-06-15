import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type DeleteCurriculumActionProps = {
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
} & CurriculumAwareActionItemProps;

export function DeleteCurriculumAction({
    sourceCurriculum,
    onDelete,
    onProcessingChange,
    ...props
}: DeleteCurriculumActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        runAction(
            () => ganttApi.curriculum.apiDelete(sourceCurriculum.id),
            () => onDelete(sourceCurriculum.id),
            "מחיקת הגאנט נכשלה!",
        );
    }, [onDelete, runAction, sourceCurriculum]);

    return (
        <ActionItemButton
            color="error"
            onClick={clickHandler}
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            tooltipTitle="מחיקה"
            {...props}
        />
    );
}
