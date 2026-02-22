import { useCalendarFilters } from "@/components/base/calendar-filter-provider";
import FilterCourses from "@/components/header/filter-courses";
import FilterInstructors from "@/components/header/filter-instructor";
import { Box, BoxProps, IconButton, Tooltip } from "@mui/material";
import ChatIcon from '@mui/icons-material/Chat';
import { useCallback } from "react";

export default function Filters({ ...props }: BoxProps)
{
    const { showPAsFor, setShowPAsFor } = useCalendarFilters();

    const handleShowPA = useCallback(() =>
    {
        setShowPAsFor(v => v === null ? 367 : null);
    }, [ setShowPAsFor ]);

    return (
        <Box
            { ...props }
        >
            <FilterInstructors
                minWidth={ 200 }
                width={ 'auto' }
                boxSizing={ 'border-box' }
            />
            <FilterCourses
                minWidth={ 200 }
                width={ 'auto' }
                boxSizing={ 'border-box' }
            />

            <Tooltip title={ showPAsFor !== null ? 'מראה חלונות פ"א' : 'גלה חלונות פ"א' }>
                <IconButton onClick={ handleShowPA } color={ showPAsFor !== null ? 'primary' : 'inherit' }>
                    <ChatIcon fontSize={ 'inherit' } />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
