import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { curriculumApi, CurriculumDocument } from '@/api-client/gant/curriculum';
import { makeCurriculum } from '@/api-shared/types/gant/curriculum';
import { ActionItemButton } from '@/components/gant/curriculum-fab/action-items/ActionItemButton';
import { BaseActionItemProps } from '@/components/gant/curriculum-fab/action-items/ActionItemProps';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

export interface CreateDraftActionProps extends BaseActionItemProps
{
    onCreate: (newCurriculum: CurriculumDocument) => void;
}

export function CreateDraftAction({ onCreate, onProcessingChange, ...props }: CreateDraftActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        onProcessingChange(true);
        curriculumApi.apiCreate(makeCurriculum())
            .then((newCurriculum) => onCreate(newCurriculum))
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, "יצירת הגאנט נשלכה!", error))
            .finally(() => onProcessingChange(false));
    }, [ enqueueSnackbar, onCreate, onProcessingChange ]);

    return (
        <ActionItemButton onClick={ clickHandler } startIcon={ <AddCircleOutlineIcon fontSize="small" /> } { ...props }>
            דראפט חדש
        </ActionItemButton>
    );
}
