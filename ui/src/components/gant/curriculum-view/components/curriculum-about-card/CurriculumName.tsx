import { Typography } from '@mui/material';
import { useCallback } from 'react';

import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { EditableCurriculumField } from '@/components/gant/curriculum-view/components/curriculum-about-card/EditableCurriculumField';
import { useCurriculumActions } from '@/components/gant/state/hooks/gant-funcs/UseCurriculumActions';

export interface CurriculumNameProps
{
    curriculumId: CurriculumId | null;
    title?: string;
}

export function CurriculumName({ curriculumId, title }: CurriculumNameProps)
{
    const { updateCurriculum } = useCurriculumActions();
    const saveNameHandler = useCallback(async (nextTitle: string) =>
    {
        if (!curriculumId)
        {
            return;
        }
        await updateCurriculum(curriculumId, { title: nextTitle });
    }, [ curriculumId, updateCurriculum ]);

    return (
        <EditableCurriculumField
            value={ title }
            canEdit={ Boolean(curriculumId) }
            editTooltip="שינוי שם תכנית"
            skeletonWidth="40%"
            allowEmpty={ false }
            onSave={ saveNameHandler }
            renderDisplay={ (value) => (
                <Typography variant="h6" color="primary">
                    { value }
                </Typography>
            ) }
        />
    );
}
