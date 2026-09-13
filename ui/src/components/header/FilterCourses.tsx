import Box, { BoxProps } from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";
import { useId } from "react";

import { CourseId } from "@/api-shared/types/course";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useCourses } from "@/components/base/CoursesProvider";

export function FilterCourses({ ...props }: BoxProps) {
    const labelId = useId();
    const { courses, getCourse } = useCourses();
    const { filteredCourses, setFilteredCourses } = useCalendarFilters();

    const handleChange = (event: SelectChangeEvent<typeof filteredCourses>) => {
        const {
            target: { value },
        } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds =
            typeof value === "string" ? value.split(",").map(String) : value;

        setFilteredCourses(newIds);
    };

    const handleDelete = (idToDelete: CourseId) => {
        setFilteredCourses((prev) => prev.filter((id) => id !== idToDelete));
    };

    return (
        <Box {...props}>
            <FormControl fullWidth={true} size="small">
                <InputLabel id={ labelId } size="small">סינון לפי מסלולים</InputLabel>
                <Select label="סינון לפי מסלולים"
                    labelId={ labelId }
                    MenuProps={{ disablePortal: true }}
                    multiple
                    onChange={handleChange}
                    renderValue={(selected) => (
                        <Box
                            fontSize={"inherit"}
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                            {selected.map((id) => {
                                // Look up course details by ID
                                const course = getCourse(id);
                                return (
                                    <Chip
                                        key={id}
                                        label={course?.name ?? id}
                                        onDelete={() => handleDelete(id)}
                                        // Prevent menu from opening when deleting
                                        onMouseDown={(e) => e.stopPropagation()}
                                        size="small"
                                        sx={{ bgcolor: course?.color }}
                                    />
                                );
                            })}
                        </Box>
                    )}
                    size="small"
                    value={filteredCourses}
                >
                    {courses.map((course) => (
                        <MenuItem
                            key={course.id}
                            sx={{
                                textDecorationColor: course.color,
                                textDecorationLine: "underline",
                            }}
                            value={course.id}
                        >
                            {course.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
