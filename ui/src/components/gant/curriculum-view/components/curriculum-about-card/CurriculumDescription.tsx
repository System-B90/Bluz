import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { EditableCurriculumField } from '@/components/gant/curriculum-view/components/curriculum-about-card/EditableCurriculumField';
import { useCurriculumActions } from '@/components/gant/state/hooks/gant-funcs/UseCurriculumActions';
import { Typography } from '@mui/material';
import { useCallback } from 'react';

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
            value={ description }
            canEdit={ Boolean(curriculumId) }
            editTooltip="שינוי תיאור תכנית"
            skeletonWidth="100%"
            multiline
            minRows={ 2 }
            allowEmpty
            onSave={ saveDescriptionHandler }
            renderDisplay={ (value) => (
                <Typography variant="body1" color='secondary' sx={ { whiteSpace: 'pre-wrap' } }>
                    { value }
                </Typography>
            ) }
        />
    );
}
