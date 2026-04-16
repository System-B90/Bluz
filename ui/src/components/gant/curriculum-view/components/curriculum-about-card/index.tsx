import { Box, Card, CardProps, Skeleton, Typography } from '@mui/material';

import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { CurriculumDescription } from '@/components/gant/curriculum-view/components/curriculum-about-card/CurriculumDescription';
import { CurriculumName } from '@/components/gant/curriculum-view/components/curriculum-about-card/CurriculumName';

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
            <Box display={ 'flex' } flexDirection={ 'row' } color="textSecondary">
                <Typography variant="body2" color="textSecondary">
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
