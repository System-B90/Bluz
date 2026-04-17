import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { CurriculumId } from '@/api-shared/types/gantt/curriculum';
import { useSyllabusActions } from '@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions';

export function CreateSyllabusButton({ curriculumId }: { curriculumId: CurriculumId; })
{
    const { enqueueSnackbar } = useSnackbar();
    const { createSyllabus } = useSyllabusActions();

    const clickHandler = useCallback(() =>
    {
        createSyllabus('סילבוס חדש', curriculumId)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'יצירת הסילבוס נכשלה!', error));
    }, [ curriculumId, createSyllabus, enqueueSnackbar ]);

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
