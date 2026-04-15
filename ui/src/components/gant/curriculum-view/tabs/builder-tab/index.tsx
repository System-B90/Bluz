import { useCurriculum } from "@/components/gant/state/hooks";
import { Box } from "@mui/material";

export interface CurriculumViewBuilderTabProps
{
    curriculumId: string;
}

export default function CurriculumViewBuilderTab({ curriculumId }: CurriculumViewBuilderTabProps)
{
    const weeks = useCurriculum(curriculumId)?.weeks ?? [];
    const syllabuses = useCurriculum(curriculumId)?.syllabuses ?? [];

    return (
        <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>

        </Box>
    );
}
