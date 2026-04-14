import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { SyllabusesActionsBox } from "@/components/gant/curriculum-view/components/syllabuses-actions-box";
import { useCurriculum } from "@/components/gant/state/hooks";
import SyllabusCard from "@/components/gant/syllabus-card";
import { Box } from "@mui/material";
import { useMemo } from "react";

export default function SyllabusesTab({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    const syllabusCards = useMemo(() =>
    {
        return (curriculum?.syllabuses ?? []).map((syllabusId) => (
            <SyllabusCard key={ syllabusId } syllabusId={ syllabusId } curriculumId={ curriculumId ?? '' } />
        ));
    }, [ curriculum?.syllabuses ]);

    return (

        <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>
            { curriculumId && (
                <Box display="flex" flexDirection="column" gap={ 1 } width={ '100%' } height={ '100%' }>
                    <SyllabusesActionsBox curriculumId={ curriculumId } mb={ 1 } />
                    <Box gap={ 2 } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } alignContent={ 'flex-start' } height={ '100%' } sx={ { overflowX: 'scroll' } }>
                        { syllabusCards }
                    </Box>
                </Box>
            ) }
        </Box>
    );
}