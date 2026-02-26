import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/courses-provider";
import { eventHasRoom, Event } from "@/components/schedule/types/event";
import { Box, Chip, FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

interface CourseFieldProps
{
    event?: Partial<Event>;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
}

export default function CourseField({ event, onEventChange, ...props }: CourseFieldProps & FormControlProps)
{
    const { courses, getCourse } = useCourses();

    // Ensure value is always an array for the Select component
    const selectedCourseIds = Array.isArray(event?.courses) ? event.courses : [];

    const handleChange = useCallback((event: SelectChangeEvent<typeof selectedCourseIds>) =>
    {
        const {
            target: { value },
        } = event;

        // On autofill we get a stringified value.
        const newCourses = (typeof value === 'string' ? value.split(',') : value).filter((id): id is CourseId => typeof id === 'string'); // Type guard to ensure we only have strings

        onEventChange({ courses: newCourses });
    }, [ onEventChange ]);

    const handleDelete = useCallback((courseIdToDelete: CourseId) =>
    {
        onEventChange(p => { return { 'courses': p.courses?.filter((id) => id !== courseIdToDelete) ?? [] }; });
    }, [ onEventChange ]);

    return (
        <FormControl fullWidth={ false } { ...props } disabled={ event?.type ? !eventHasRoom(event.type) : false }>
            <InputLabel>מסלולים</InputLabel>
            <Select
                label="מסלולים"
                multiple
                value={ selectedCourseIds }
                onChange={ handleChange }
                renderValue={ (selected: Array<CourseId>) => (
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                        { selected.map((value) => (
                            <Chip
                                key={ value }
                                label={ getCourse(value)?.name || value }
                                size="small" // Optional: makes them fit better
                                onDelete={ () => handleDelete(value) }
                                onMouseDown={ (event) => event.stopPropagation() }
                            />
                        )) }
                    </Box>
                ) }
            >
                { courses.map((course) => (
                    <MenuItem key={ course.id } value={ course.id } color={ course.color ?? undefined }>
                        { course.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}
