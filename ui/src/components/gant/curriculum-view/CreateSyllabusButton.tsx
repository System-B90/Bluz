import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { useGantFuncs } from '@/components/gant/state/hooks';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { useCallback } from 'react';

export function CreateSyllabusButton({ curriculumId }: { curriculumId: CurriculumId; })
{
    const { createSyllabus } = useGantFuncs();

    const clickHandler = useCallback(() =>
    {
        createSyllabus('סילבוס חדש', curriculumId);
    }, [ curriculumId, createSyllabus ]);

    return (
        <Button
            variant="contained"
            startIcon={ <AddIcon /> }
            onClick={ clickHandler }
        >
            סילבוס חדש
        </Button>
    );
}
