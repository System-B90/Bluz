import { TextField } from '@mui/material';
import { useSnackbar } from 'notistack';
import { ChangeEventHandler, useCallback, useState } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { SyllabusId } from "@/api-shared/types/gantt/curriculum";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from '@/components/gantt/state/hooks/UseSyllabus';

export function SyllabusName({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { enqueueSnackbar } = useSnackbar();
    const { updateSyllabus } = useSyllabusActions();
    const syllabus = useSyllabus(syllabusId);
    const [ localTitle, setLocalTitle ] = useState(syllabus?.title ?? '');

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) =>
    {
        setLocalTitle(e.target.value);
    }, []);

    const onBlur = useCallback(() =>
    {
        updateSyllabus(syllabusId, { title: localTitle })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת שם הסילבוס נכשלה!', error));
    }, [ syllabusId, localTitle, updateSyllabus, enqueueSnackbar ]);

    return (
        <TextField
            fullWidth
            label="שם הסילבוס"
            onBlur={ onBlur }
            onChange={ onChange }
            required
            size="small"
            type="text"
            value={ localTitle }
            variant="standard"
        />
    );
}
