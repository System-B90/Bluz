import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { curriculumApi, CurriculumDocument } from '@/api-client/gant/curriculum';
import { CreateCurriculumPayload } from '@/api-shared/types/gant/create-payloads';
import { ActionItemButton } from '@/components/gant/curriculum-fab/action-items/ActionItemButton';
import { CurriculumAwareActionItemProps } from '@/components/gant/curriculum-fab/action-items/ActionItemProps';

export interface DuplicateCurriculumActionProps extends CurriculumAwareActionItemProps
{
    onCreate: (newCurriculum: CurriculumDocument) => void;
}

export function DuplicateCurriculumAction({ sourceCurriculum, onCreate, onProcessingChange, ...props }: DuplicateCurriculumActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        const payload: Omit<CreateCurriculumPayload, 'weeks'> & { weeks: typeof sourceCurriculum.weeks } = {
            title: `${sourceCurriculum.title} (Copy)`,
            description: sourceCurriculum.description,
            isDraft: true,
            weeks: sourceCurriculum.weeks,
        };
        // Cast to proper type - duplication uses the same week IDs structure
        curriculumApi.apiCreate(payload as CreateCurriculumPayload)
            .then((newCurriculum) => onCreate(newCurriculum))
            .catch((error: unknown) => enqueueApiErrorSnackbar(enqueueSnackbar, "שכפול הגאנט נכשל!", error))
            .finally(() => onProcessingChange(false));
    }, [ enqueueSnackbar, onCreate, onProcessingChange, sourceCurriculum ]);

    return (
        <ActionItemButton onClick={ clickHandler } startIcon={ <ContentCopyIcon fontSize="small" /> } { ...props }>
            שכפול
        </ActionItemButton>
    );
}
