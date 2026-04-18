import {
  Box,
  BoxProps,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";

import { CourseId } from "@/api-shared/types/course";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useCourses } from "@/components/base/CoursesProvider";

export function FilterCourses({ ...props }: BoxProps) {
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
        <InputLabel size="small">סינון לפי מסלולים</InputLabel>
        <Select
          label="סינון לפי מסלולים"
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
