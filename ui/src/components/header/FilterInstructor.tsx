import {
    Box,
    BoxProps,
    Chip,
    FormControl,
    InputLabel,
    SelectChangeEvent,
} from "@mui/material";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { InstructorSelect } from "@/components/base/InstructorSelect";

export function FilterInstructors({ ...props }: BoxProps) {
    const { getInstructor } = useHiveUsers();
    const { filteredInstructors, setFilteredInstructors } = useCalendarFilters();

    const handleChange = (
        event: SelectChangeEvent<typeof filteredInstructors>,
    ) => {
        const {
            target: { value },
        } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds =
            typeof value === "string" ? value.split(",").map(Number) : value;

        setFilteredInstructors(newIds);
    };

    const handleDelete = (idToDelete: number) => {
        setFilteredInstructors((prev) => prev.filter((id) => id !== idToDelete));
    };

    return (
        <Box {...props}>
            <FormControl fullWidth={true} size="small">
                <InputLabel size="small">סינון לפי מדריכים</InputLabel>
                <InstructorSelect
                    excludeTeachers={true}
                    label="סינון לפי מדריכים"
                    multiple
                    onChange={handleChange}
                    renderValue={(selected) => (
                        <Box
                            fontSize={"inherit"}
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                            {selected.map((id) => {
                                // Look up instructor details by ID
                                const instructor = getInstructor(id);
                                return (
                                    <Chip
                                        key={id}
                                        label={instructor?.display_name || id}
                                        onDelete={() => handleDelete(id)}
                                        // Prevent menu from opening when deleting
                                        onMouseDown={(e) => e.stopPropagation()}
                                        size="small"
                                    />
                                );
                            })}
                        </Box>
                    )}
                    size="small"
                    value={filteredInstructors}
                />
            </FormControl>
        </Box>
    );
}
