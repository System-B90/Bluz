import { Box, Card, CardProps, Skeleton, Typography } from '@mui/material';

import { CurriculumDocument } from '@/api-client/gantt/curriculum';
import { CurriculumId } from '@/api-shared/types/gantt/curriculum';
import { CurriculumDescription } from '@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumDescription';
import { CurriculumName } from '@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumName';

export interface CurriculumCardProps extends Omit<CardProps, 'sx'>
{
    curriculumId: CurriculumId | null;
    curriculum: CurriculumDocument | undefined;
}

export function CurriculumAboutCard({ curriculumId, curriculum, ...props }: CurriculumCardProps)
{
    return (
        <Card sx={ { padding: 2, minWidth: '14rem', flexShrink: 0, } } { ...props }>
            <CurriculumName curriculumId={ curriculumId } title={ curriculum?.title } />
            <CurriculumDescription curriculumId={ curriculumId } description={ curriculum?.description } />
            <Box color="textSecondary" display={ 'flex' } flexDirection={ 'row' }>
                <Typography color="textSecondary" variant="body2">
                    עדכון אחרון:
                </Typography>
                <Box width={ '0.2rem' } />
                { curriculum?.updatedAt ? (
                    <Typography color="textSecondary">{ curriculum.updatedAt.format('DD/MM/YYYY') }</Typography>
                ) : (
                    <Skeleton variant='text' width={ 80 } />
                ) }
            </Box>
        </Card>
    );
}
