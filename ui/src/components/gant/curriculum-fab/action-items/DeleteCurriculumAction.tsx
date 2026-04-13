import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { curriculumApi } from '@/api-client/gant/curriculum';
import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { ActionItemButton } from '@/components/gant/curriculum-fab/action-items/ActionItemButton';
import { CurriculumAwareActionItemProps } from '@/components/gant/curriculum-fab/action-items/ActionItemProps';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

export interface DeleteCurriculumActionProps extends CurriculumAwareActionItemProps
{
    onDelete: (deletedCurriculumId: CurriculumId) => void;
}

export function DeleteCurriculumAction({ sourceCurriculum, onDelete, onProcessingChange, ...props }: DeleteCurriculumActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        curriculumApi.apiDelete(sourceCurriculum.id)
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
