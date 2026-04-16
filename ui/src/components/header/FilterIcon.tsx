import FilterListIcon from '@mui/icons-material/FilterList';
import InfoIcon from '@mui/icons-material/Info';
import { Tooltip, IconButton } from '@mui/material';
import { Dispatch, SetStateAction, useMemo } from 'react';

import { useCalendarFilters } from '@/components/base/CalendarFilterProvider';

export default function FilterIcon({ filtersVisible, setFiltersVisible }: { filtersVisible: boolean, setFiltersVisible: Dispatch<SetStateAction<boolean>>; })
{
    const { showPAsFor, filteredCourses, filteredInstructors, hidePrayers } = useCalendarFilters();
    const hasAnyFilter = useMemo(() => hidePrayers || filteredCourses.length !== 0 || filteredInstructors.length !== 0 || showPAsFor !== null, [ filteredCourses, filteredInstructors, showPAsFor, hidePrayers ]);
    return (
        <Tooltip title={ `${filtersVisible ? 'Hide' : 'Show'} Filters` } placement='bottom'>
            <IconButton className='relative' color={ filtersVisible ? 'primary' : 'inherit' } onClick={ () => { setFiltersVisible(v => !v); } }>
                <FilterListIcon />
                { (!filtersVisible && hasAnyFilter) && <Tooltip placement='right' title='יש סננים נסתרים'><InfoIcon className='absolute top-0.5 right-0.5' color='info' fontSize='inherit' sx={ { fontSize: '1.1rem' } } /></Tooltip> }
            </IconButton>
        </Tooltip>
    );
}
