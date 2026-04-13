import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useSyllabus } from '@/components/gant/state/hooks';
import { Card, CardContent, CardHeader, Typography } from '@mui/material';
import { ModulesTable } from './ModulesTable';
import { SyllabusName } from './SyllabusName';

export default function SyllabusCard({ syllabusId }: { syllabusId: SyllabusId; })
{
    const syllabus = useSyllabus(syllabusId);

    return (
        <Card sx={ { display: 'flex', flexDirection: 'column', width: '30%', minWidth: 350, maxHeight: '90%', overflow: 'hidden' } }>
            <CardHeader
                title={ <Typography variant="subtitle2" color="textSecondary">סילבוס</Typography> }
                sx={ { pb: 0, pt: 1.5, px: 2 } }
            />
            <CardContent sx={ { display: 'flex', flexDirection: 'column', paddingY: 1, flex: 1, overflow: 'hidden' } }>
                <SyllabusName key={ `${syllabus?.title ?? '-syllabus-title'}` } syllabusId={ syllabusId } />
                <ModulesTable syllabusModules={ syllabus?.modules ?? [] } syllabusId={ syllabusId } />
            </CardContent>
        </Card>
    );
}
