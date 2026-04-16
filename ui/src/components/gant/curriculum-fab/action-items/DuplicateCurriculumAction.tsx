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

function copyWeeksForPayload(source: CurriculumDocument): CreateCurriculumPayload[ 'weeks' ]
{
    return source.weeks.map((week) => ({
        number: week.number,
        comment: week.comment,
        closingSaturday: week.closingSaturday,
        days: week.days.map((day) => ({
            day: day.day,
            totalWorkingHours: day.totalWorkingHours,
            comment: day.comment,
        })),
    }));
}

export function DuplicateCurriculumAction({ sourceCurriculum, onCreate, onProcessingChange, ...props }: DuplicateCurriculumActionProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const clickHandler = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        onProcessingChange(true);
        const payload: CreateCurriculumPayload = {
            title: `${sourceCurriculum.title} (Copy)`,
            description: sourceCurriculum.description,
            draft: true,
            weeks: copyWeeksForPayload(sourceCurriculum),
        };
        curriculumApi.apiCreate(payload)
            .then((newCurriculum) => onCreate(newCurriculum))
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, "שכפול הגאנט נכשל!", error))
            .finally(() => onProcessingChange(false));
    }, [ enqueueSnackbar, onCreate, onProcessingChange, sourceCurriculum ]);

    return (
        <ActionItemButton onClick={ clickHandler } startIcon={ <ContentCopyIcon fontSize="small" /> } { ...props }>
            שכפול
        </ActionItemButton>
    );
}
