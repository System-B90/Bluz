import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import { Tooltip, IconButton } from '@mui/material';
import { Dispatch, SetStateAction, useMemo } from 'react';
import { useCalendarFilters } from '@/components/base/calendar-filter-provider';


export default function FilterIcon({ filtersVisible, setFiltersVisible }: { filtersVisible: boolean, setFiltersVisible: Dispatch<SetStateAction<boolean>>; })
{
    const { filteredCourses, filteredInstructors } = useCalendarFilters();
    const hasAnyFilter = useMemo(() => filteredCourses.length !== 0 || filteredInstructors.length !== 0, [ filteredCourses, filteredInstructors ]);
    return (
        <Tooltip title={ `${filtersVisible ? 'Hide' : 'Show'} Filters` } placement='bottom'>
            <IconButton className='relative' color="inherit" onClick={ () => { setFiltersVisible(v => !v); } }>
                <FilterListIcon color={ filtersVisible ? 'primary' : 'inherit' } />
                { (!filtersVisible && hasAnyFilter) && <Tooltip placement='right' title='יש סננים נסתרים'><InfoIcon className='absolute top-0.5 right-0.5' color='info' fontSize='inherit' sx={ { fontSize: '1.1rem' } } /></Tooltip> }
            </IconButton>
        </Tooltip>
    );
}