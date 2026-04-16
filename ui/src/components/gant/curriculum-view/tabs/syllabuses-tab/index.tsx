import { Box } from "@mui/material";
import { useMemo } from "react";

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { SyllabusesActionsBox } from "@/components/gant/curriculum-view/components/syllabuses-actions-box";
import { useCurriculum } from '@/components/gant/state/hooks/UseCurriculum';
import { SyllabusCard } from "@/components/gant/syllabus-card";

export function SyllabusesTab({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    const syllabusCards = useMemo(() =>
    {
        return (curriculum?.syllabuses ?? []).map((syllabusId) => (
            <SyllabusCard curriculumId={ curriculumId ?? '' } key={ syllabusId } syllabusId={ syllabusId } />
        ));
    }, [ curriculum?.syllabuses, curriculumId ]);

    return (
        <Box display={ 'flex' } flexDirection={ 'column' } flexGrow={ 1 } gap={ 2 } height={ '100%' }>
            <Box display="flex" flexDirection="column" gap={ 1 } height={ '100%' } width={ '100%' }>
                <SyllabusesActionsBox curriculumId={ curriculumId } mb={ 1 } />
                <Box alignContent={ 'flex-start' } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } gap={ 2 } height={ '100%' } sx={ { overflowX: 'scroll' } }>
                    { syllabusCards }
                </Box>
            </Box>
        </Box>
    );
}
