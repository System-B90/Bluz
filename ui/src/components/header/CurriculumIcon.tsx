'use client';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { IconButton, Tooltip } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function CurriculumIcon()
{
    const pathname = usePathname();
    const curriculumPage = pathname.includes('/gantt');

    const router = useRouter();
    const onClick = useCallback(() =>
    {
        router.push(curriculumPage ? '/' : '/gantt/');
    }, [ curriculumPage, router ]);

    return (
        <Tooltip placement='bottom' title={ curriculumPage ? 'בחזרה ללו"ז' : 'בניית גאנט' }>
            <IconButton className='relative' color={ 'inherit' } onClick={ onClick }>
                { curriculumPage ? <CalendarMonthIcon /> : <AutoStoriesIcon /> }
            </IconButton>
        </Tooltip>
    );
}
