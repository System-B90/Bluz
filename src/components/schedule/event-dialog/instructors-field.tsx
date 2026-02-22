import { useHiveUsers } from "@/components/base/hive-users-provider";
import { EventType, Event } from "@/components/schedule/types/event";
import { Box, Chip, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import React, { Dispatch, SetStateAction, useMemo } from "react";

interface InstructorsFieldProps
{
    event?: Partial<Event>;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
}

function LecturerSelectionField({ event, onEventChange, ...props }: InstructorsFieldProps & React.HTMLAttributes<HTMLDivElement>)
{
    const { instructors, getInstructor } = useHiveUsers();

    // Ensure selectedIds is always an array to prevent crashes
    const selectedIds = event?.lecturers || [];

    const handleChange = (event: SelectChangeEvent<typeof selectedIds>) =>
    {
        const { target: { value } } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds = typeof value === 'string'
            ? value.split(',').map((v) => v === 'איש חוץ' ? 'איש חוץ' : Number(v))
            : value;

        // Use functional update pattern for SetStateAction
        onEventChange((prev) => ({
            ...prev,
            lecturers: newIds
        }));
    };

    const handleDelete = (idToDelete: number | string) =>
    {
        onEventChange((prev) => ({
            ...prev,
            lecturers: (prev?.lecturers || []).filter((id) => id !== idToDelete)
        }));
    };

    return (
        <Box{ ...props }>
            <FormControl fullWidth={ true } >
                <InputLabel>מרצים</InputLabel>
                <Select
                    multiple
                    label="מרצים"
                    value={ selectedIds }
                    onChange={ handleChange }
                    renderValue={ (selected) => (
                        <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                            { selected.map((id) =>
                            {
                                // Look up instructor details by ID
                                const lecturer = typeof id === 'number' ? getInstructor(id) : { id, display_name: id };
                                return (
                                    <Chip
                                        key={ id }
                                        label={ lecturer?.display_name || id }
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
                    <MenuItem key={ 'outside-lecturer' } value={ 'איש חוץ' }>איש חוץ</MenuItem>
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

export default function InstructorsField({ event, onEventChange }: InstructorsFieldProps)
{
    const { instructors, getInstructor } = useHiveUsers();

    const isLecture = useMemo(() => event?.type === EventType.LECTURE, [ event?.type ]);

    // Ensure selectedIds is always an array to prevent crashes
    const selectedIds = event?.instructors || [];

    const handleChange = (event: SelectChangeEvent<typeof selectedIds>) =>
    {
        const { target: { value } } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds = typeof value === 'string'
            ? value.split(',').map(Number)
            : value;

        // Use functional update pattern for SetStateAction
        onEventChange((prev) => ({
            ...prev,
            instructors: newIds as number[]
        }));
    };

    const handleDelete = (idToDelete: number) =>
    {
        onEventChange((prev) => ({
            ...prev,
            instructors: (prev?.instructors || []).filter((id) => id !== idToDelete)
        }));
    };

    return (
        <Box width={ '100%' } display={ 'flex' } gap={ isLecture ? 2 : 0 } >
            <Box flexGrow={ 1 }>
                <FormControl fullWidth={ true } >
                    <InputLabel>מבוזרים</InputLabel>
                    <Select
                        multiple
                        label="מבוזרים"
                        value={ selectedIds }
                        onChange={ handleChange }
                        renderValue={ (selected) => (
                            <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
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
            { isLecture &&
                <LecturerSelectionField event={ event } onEventChange={ onEventChange } className="w-[30%]" />
            }
        </Box>
    );
}
