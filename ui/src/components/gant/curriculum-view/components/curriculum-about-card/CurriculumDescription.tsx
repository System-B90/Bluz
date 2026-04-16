import { Typography } from '@mui/material';
import { useCallback } from 'react';

import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { EditableCurriculumField } from '@/components/gant/curriculum-view/components/curriculum-about-card/EditableCurriculumField';
import { useCurriculumActions } from '@/components/gant/state/hooks/gant-funcs/UseCurriculumActions';

export interface CurriculumDescriptionProps
{
    curriculumId: CurriculumId | null;
    description?: string;
}

export function CurriculumDescription({ curriculumId, description }: CurriculumDescriptionProps)
{
    const { updateCurriculum } = useCurriculumActions();
    const saveDescriptionHandler = useCallback(async (nextDescription: string) =>
    {
        if (!curriculumId)
        {
            return;
        }
        await updateCurriculum(curriculumId, { description: nextDescription });
    }, [ curriculumId, updateCurriculum ]);

    return (
        <EditableCurriculumField
            allowEmpty
            canEdit={ Boolean(curriculumId) }
            editTooltip="שינוי תיאור תכנית"
            minRows={ 2 }
            multiline
            onSave={ saveDescriptionHandler }
            renderDisplay={ (value) => (
                <Typography color='secondary' sx={ { whiteSpace: 'pre-wrap' } } variant="body1">
                    { value }
                </Typography>
            ) }
            skeletonWidth="100%"
            value={ description }
        />
    );
}
