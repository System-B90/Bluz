import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useSyllabus } from '@/components/gant/state/hooks';
import { CardContent } from '@mui/material';
import { ModulesTable } from './ModulesTable';
import { SyllabusName } from './SyllabusName';

export function SyllabusCardInner({ syllabusId }: { syllabusId: SyllabusId; })
{
    const syllabus = useSyllabus(syllabusId);
    return (
        <>
            <CardContent sx={ { display: 'flex', flexDirection: 'column', paddingY: 1, flex: 1, overflow: 'hidden' } }>
                <SyllabusName key={ `${syllabus?.title ?? '-syllabus-title'}` } syllabusId={ syllabusId } />
                <ModulesTable syllabusModules={ syllabus?.modules ?? [] } syllabusId={ syllabusId } />
            </CardContent>
        </>
    );
}
