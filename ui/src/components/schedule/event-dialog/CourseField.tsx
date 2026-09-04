import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";
import { useCallback, useState } from "react";

import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { eventHasRoom } from "@/components/schedule/types/event";

type CourseFieldProps = {} & EventFieldProps;

export function CourseField({
    event,
    onBlurCallback,
    ...props
}: CourseFieldProps & FormControlProps) {
    const { courses, getCourse } = useCourses();
    const [currentCourseIds, setCurrentCourseIds] = useState(
        Array.isArray(event?.courses) ? event.courses : [],
    );

    // The initial useState value only runs once, so if the edited event
    // changed underneath us mid-session (e.g. a WS update while the dialog
    // is open) the selection would keep showing stale courses without help.
    // The caller (EventClassification.tsx) remounts this component with
    // key={`${event.id}-${event.updatedAt}`}, which resets this state
    // instead of relying on an effect to resync it.
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

    const handleDelete = useCallback(
        (courseIdToDelete: CourseId) => {
            const remaining = currentCourseIds.filter(
                (id) => id !== courseIdToDelete,
            );
            setCurrentCourseIds(remaining);
            // The chip's own onMouseDown stops the menu from opening, so
            // onClose never fires and the removal reached nothing but local
            // state — the course was still saved (#615).
            onBlurCallback({ courses: remaining });
        },
        [currentCourseIds, onBlurCallback],
    );

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
