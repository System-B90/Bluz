import { Box, CardHeader, CardHeaderProps } from "@mui/material";

import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useSyllabus } from "@/components/gant/state/hooks";
import { HoursBox } from "@/components/gant/syllabus-card/HoursBox";
import { SyllabusName } from "@/components/gant/syllabus-card/SyllabusName";

export interface SyllabusCardHeaderProps extends Omit<CardHeaderProps, 'title'>
{
    syllabusId: SyllabusId;
}

function InternalHeader({ syllabusId }: { syllabusId: SyllabusId; })
{
    const syllabus = useSyllabus(syllabusId);

    return (
        <Box
            display={ 'flex' }
            flexDirection={ 'row' }
            alignItems={ 'center' }
            flexWrap={ 'nowrap' }
        >
            <SyllabusName key={ `${syllabus?.title ?? '-syllabus-title'}` } syllabusId={ syllabusId } />
            <HoursBox syllabusId={ syllabusId } />
        </Box>
    );
}

export default function SyllabusCardHeader({ syllabusId, ...props }: SyllabusCardHeaderProps)
{
    return (
        <CardHeader
            title={ <InternalHeader syllabusId={ syllabusId } /> }
            { ...props }
        />
    );
}
