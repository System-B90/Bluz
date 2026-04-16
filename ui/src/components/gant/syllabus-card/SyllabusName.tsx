import { TextField } from '@mui/material';
import { ChangeEventHandler, useCallback, useState } from 'react';

import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useSyllabus } from '@/components/gant/state/hooks';
import { useSyllabusActions } from "@/components/gant/state/hooks/gant-funcs/UseSyllabusActions";

export function SyllabusName({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { updateSyllabus } = useSyllabusActions();
    const syllabus = useSyllabus(syllabusId);
    const [ localTitle, setLocalTitle ] = useState(syllabus?.title ?? '');

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) =>
    {
        setLocalTitle(e.target.value);
    }, []);

    const onBlur = useCallback(() =>
    {
        updateSyllabus(syllabusId, { title: localTitle });
    }, [ syllabusId, localTitle, updateSyllabus ]);

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
