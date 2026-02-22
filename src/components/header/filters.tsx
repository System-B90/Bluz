import FilterCourses from "@/components/header/filter-courses";
import FilterInstructors from "@/components/header/filter-instructor";
import { Box, BoxProps } from "@mui/material";

export default function Filters({ ...props }: BoxProps)
{
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
        </Box>
    );
}