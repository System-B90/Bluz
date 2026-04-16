'use client';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Tooltip, IconButton } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
export default function CurriculumIcon()
{
    const pathname = usePathname();
    const curriculumPage = pathname.includes('/curriculum');

    const router = useRouter();
    const onClick = useCallback(() =>
    {
        router.push(curriculumPage ? '/' : '/curriculum/');
    }, [ curriculumPage, router ]);

    return (
        <Tooltip title={ curriculumPage ? 'בחזרה ללו"ז' : 'בניית גאנט' } placement='bottom'>
            <IconButton className='relative' color={ 'inherit' } onClick={ onClick }>
                { curriculumPage ? <CalendarMonthIcon /> : <AutoStoriesIcon /> }
            </IconButton>
        </Tooltip>
    );
}
