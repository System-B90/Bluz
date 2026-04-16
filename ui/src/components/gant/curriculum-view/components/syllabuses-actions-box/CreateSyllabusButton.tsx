import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { useCallback } from 'react';

import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { useSyllabusActions } from '@/components/gant/state/hooks/gant-funcs/UseSyllabusActions';

export function CreateSyllabusButton({ curriculumId }: { curriculumId: CurriculumId; })
{
    const { createSyllabus } = useSyllabusActions();

    const clickHandler = useCallback(() =>
    {
        createSyllabus('סילבוס חדש', curriculumId);
    }, [ curriculumId, createSyllabus ]);

    return (
        <Button
            onClick={ clickHandler }
            startIcon={ <AddIcon /> }
            variant="contained"
        >
            סילבוס חדש
        </Button>
    );
}
