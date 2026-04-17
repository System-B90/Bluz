import { Box, CardHeader, CardHeaderProps } from "@mui/material";

import { SyllabusId } from "@/api-shared/types/gantt/curriculum";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { HoursBox } from "@/components/gantt/syllabus-card/HoursBox";
import { SyllabusName } from "@/components/gantt/syllabus-card/SyllabusName";

export interface SyllabusCardHeaderProps extends Omit<CardHeaderProps, 'title'>
{
    syllabusId: SyllabusId;
}

function InternalHeader({ syllabusId }: { syllabusId: SyllabusId; })
{
    const syllabus = useSyllabus(syllabusId);

    return (
        <Box
            alignItems={ 'center' }
            display={ 'flex' }
            flexDirection={ 'row' }
            flexWrap={ 'nowrap' }
        >
            <SyllabusName key={ `${syllabus?.title ?? '-syllabus-title'}` } syllabusId={ syllabusId } />
            <HoursBox syllabusId={ syllabusId } />
        </Box>
    );
}

export function SyllabusCardHeader({ syllabusId, ...props }: SyllabusCardHeaderProps)
{
    return (
        <CardHeader
            title={ <InternalHeader syllabusId={ syllabusId } /> }
            { ...props }
        />
    );
}
