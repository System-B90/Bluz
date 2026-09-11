import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Fragment, useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";
import { useConfirmDialog } from "@/components/settings-dialog/tabs/global/common/UseConfirmDialog";

export type DeleteCurriculumActionProps = {
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
} & CurriculumAwareActionItemProps;

export function DeleteCurriculumAction({
    sourceCurriculum,
    onDelete,
    onProcessingChange,
    loading,
    ...props
}: DeleteCurriculumActionProps)
{
    const runAction = useAsyncAction(onProcessingChange);
    const { confirm, confirmDialog } = useConfirmDialog();

    const clickHandler = useCallback(async () =>
    {
        if (!sourceCurriculum) return;
        if (!(await confirm(`למחוק את הגאנט "${sourceCurriculum.title}"?`, { 'confirmLabel': 'למחוק' }))) { return; }
        runAction(
            () => ganttApi.curriculum.apiDelete(sourceCurriculum.id),
            () => onDelete(sourceCurriculum.id),
            "מחיקת הגאנט נכשלה!",
        );
    }, [ onDelete, runAction, sourceCurriculum ]);

    return (
        <Fragment>

            <ActionItemButton
                color="error"
                loading={ loading }
                onClick={ clickHandler }
                startIcon={ <DeleteOutlineIcon fontSize="small" /> }
                tooltipTitle="מחיקה"
                { ...props }
            />
            { confirmDialog }
        </Fragment>
    );
}
