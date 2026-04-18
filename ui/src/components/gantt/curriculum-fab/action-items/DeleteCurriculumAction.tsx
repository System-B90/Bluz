import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { ganttApi } from '@/api-client/gantt';
import { GanttCurriculumId } from '@/api-shared/types/gantt/models/curriculum';
import { ActionItemButton } from '@/components/gantt/curriculum-fab/action-items/ActionItemButton';
import { CurriculumAwareActionItemProps } from '@/components/gantt/curriculum-fab/action-items/ActionItemProps';

export interface DeleteCurriculumActionProps extends CurriculumAwareActionItemProps
{
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
}

export function DeleteCurriculumAction({ sourceCurriculum, onDelete, onProcessingChange, ...props }: DeleteCurriculumActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        ganttApi.curriculum.apiDelete(sourceCurriculum.id)
            .then(() => onDelete(sourceCurriculum.id))
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, "מחיקת הגאנט נכשלה!", error))
            .finally(() => onProcessingChange(false));
    }, [ enqueueSnackbar, onDelete, onProcessingChange, sourceCurriculum ]);

    return (
        <ActionItemButton color="error" onClick={ clickHandler } startIcon={ <DeleteOutlineIcon fontSize="small" /> } { ...props }>
            מחיקה
        </ActionItemButton>
    );
}
