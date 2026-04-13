import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { PersonId } from "@/components/schedule/types/event";
import { Box, BoxProps, Chip, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useState } from "react";

export default function FilterInstructors({ ...props }: BoxProps)
{
    const { instructors, getInstructor } = useHiveUsers();
    const { filteredInstructors, setFilteredInstructors } = useCalendarFilters();

    const handleChange = (event: SelectChangeEvent<typeof filteredInstructors>) =>
    {
        const { target: { value } } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds = typeof value === 'string'
            ? value.split(',').map(Number)
            : value;

        setFilteredInstructors(newIds);
    };

    const handleDelete = (idToDelete: number) =>
    {
        setFilteredInstructors(prev => prev.filter(id => id !== idToDelete));
    };

    return (
        <Box { ...props }>
            <FormControl fullWidth={ true } size="small">
                <InputLabel size="small">סינון לפי מדריכים</InputLabel>
                <Select
                    multiple
                    size="small"
                    label="סינון לפי מדריכים"
                    value={ filteredInstructors }
                    onChange={ handleChange }
                    renderValue={ (selected) => (
                        <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } } fontSize={ 'inherit' }>
                            { selected.map((id) =>
                            {
                                // Look up instructor details by ID
                                const instructor = getInstructor(id);
                                return (
                                    <Chip
                                        key={ id }
                                        label={ instructor?.display_name || id }
                                        size="small"
                                        onDelete={ () => handleDelete(id) }
                                        // Prevent menu from opening when deleting
                                        onMouseDown={ (e) => e.stopPropagation() }
                                    />
                                );
                            }) }
                        </Box>
                    ) }
                >
                    { instructors.map((instructor) => (
                        <MenuItem key={ instructor.id } value={ instructor.id }>
                            { instructor.display_name }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

        </Box>
    );
}
