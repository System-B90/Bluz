import {
    Box,
    Chip,
    FormControl,
    FormControlProps,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";
import { useCallback, useState } from "react";

import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { eventHasRoom } from "@/components/schedule/types/event";

interface CourseFieldProps extends EventFieldProps {}

export function CourseField({
    event,
    onBlurCallback,
    ...props
}: CourseFieldProps & FormControlProps) {
    const { courses, getCourse } = useCourses();
    const [currentCourseIds, setCurrentCourseIds] = useState(
        Array.isArray(event?.courses) ? event.courses : [],
    );

    const handleChange = useCallback(
        (event: SelectChangeEvent<typeof currentCourseIds>) => {
            const {
                target: { value },
            } = event;

            // On autofill we get a stringified value.
            const newCourses = (
                typeof value === "string" ? value.split(",") : value
            ).filter((id): id is CourseId => typeof id === "string"); // Type guard to ensure we only have strings

            setCurrentCourseIds(newCourses);
        },
        [],
    );

    const handleDelete = useCallback((courseIdToDelete: CourseId) => {
        setCurrentCourseIds((p) => p.filter((id) => id !== courseIdToDelete) ?? []);
    }, []);

    const onClose = useCallback(() => {
        onBlurCallback({ courses: currentCourseIds });
    }, [currentCourseIds, onBlurCallback]);

    return (
        <FormControl
            fullWidth={false}
            {...props}
            disabled={event?.type ? !eventHasRoom(event.type) : false}
        >
            <InputLabel>מסלולים</InputLabel>
            <Select
                label="מסלולים"
                multiple
                onChange={handleChange}
                onClose={onClose}
                renderValue={(selected: Array<CourseId>) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => (
                            <Chip
                                key={value}
                                label={getCourse(value)?.name ?? value}
                                onDelete={() => handleDelete(value)}
                                onMouseDown={(event) => event.stopPropagation()}
                                size="small" // Optional: makes them fit better
                            />
                        ))}
                    </Box>
                )}
                value={currentCourseIds}
            >
                {courses.map((course) => (
                    <MenuItem
                        color={course.color ?? undefined}
                        key={course.id}
                        value={course.id}
                    >
                        {course.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
