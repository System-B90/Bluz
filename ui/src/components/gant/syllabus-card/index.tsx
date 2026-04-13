import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { Card, CardHeader, Typography } from '@mui/material';
import { SyllabusCardInner } from './SyllabusCardInner';

export default function SyllabusCard({ syllabusId }: { syllabusId: SyllabusId; })
{
    return (
        <Card sx={ { display: 'flex', flexDirection: 'column', width: '30%', minWidth: 350, maxHeight: '90%', overflow: 'hidden' } }>
            <CardHeader
                title={ <Typography variant="subtitle2" color="textSecondary">סילבוס</Typography> }
                sx={ { pb: 0, pt: 1.5, px: 2 } }
            />
            <SyllabusCardInner syllabusId={ syllabusId } />
        </Card>
    );
}
