import EditNoteIcon from '@mui/icons-material/EditNote';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { curriculumApi } from '@/api-client/gant/curriculum';
import { ActionItemButton } from '@/components/gant/curriculum-fab/action-items/ActionItemButton';
import { CurriculumAwareActionItemProps } from '@/components/gant/curriculum-fab/action-items/ActionItemProps';

export interface ToggleDraftActionProps extends CurriculumAwareActionItemProps
{
    onUpdate: (updatedCurriculum: CurriculumDocument) => void;
}

export function ToggleDraftAction({ sourceCurriculum, onUpdate, onProcessingChange, ...props }: ToggleDraftActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        const nextDraftState = !sourceCurriculum.draft;
        curriculumApi.apiUpdate({ id: sourceCurriculum.id, draft: nextDraftState })
            .then((updatedCurriculum) => onUpdate(updatedCurriculum))
            .catch((error) => enqueueApiErrorSnackbar(
                enqueueSnackbar,
                sourceCurriculum.draft ? "פרסום הגאנט נכשל!" : "העברה לדראפט נכשלה!",
                error
            ))
            .finally(() => onProcessingChange(false));
    }, [ enqueueSnackbar, onProcessingChange, onUpdate, sourceCurriculum ]);

    return (
        <ActionItemButton
            onClick={ clickHandler }
            startIcon={ sourceCurriculum?.draft ? <TaskAltIcon fontSize="small" /> : <EditNoteIcon fontSize="small" /> }
            color={ sourceCurriculum?.draft ? 'success' : 'warning' }
            { ...props }
        >
            { sourceCurriculum?.draft ? 'פיבלוש' : 'החזרה לדראפט' }
        </ActionItemButton>
    );
}
