import ChatIcon from '@mui/icons-material/Chat';
import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import SynagogueIcon from '@mui/icons-material/Synagogue';
import { Box, BoxProps, IconButton, Tooltip } from "@mui/material";
import { useCallback } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import FilterCourses from "@/components/header/FilterCourses";
import FilterInstructors from "@/components/header/FilterInstructor";

export default function Filters({ ...props }: BoxProps)
{
    const { showPAsFor, setShowPAsFor, hidePrayers, setHidePrayers } = useCalendarFilters();

    const handleShowPA = useCallback(() =>
    {
        setShowPAsFor(v => v === null ? 365 : null);
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
                    <ChatIcon />
                </IconButton>
            </Tooltip>

            <Tooltip title={ hidePrayers ? 'הראה תפילות' : 'הסתר תפילות' }>
                <IconButton className="relative" onClick={ () => setHidePrayers(v => !v) } color="inherit">
                    <SynagogueIcon sx={ { opacity: hidePrayers ? 0.7 : 1, padding: hidePrayers ? 0.3 : 0 } } />
                    <DoNotDisturbAltIcon className="absolute" sx={ { opacity: hidePrayers ? 1 : 0 } } fontSize="large" color="secondary" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
