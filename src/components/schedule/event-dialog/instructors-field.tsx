import { useHiveUsers } from "@/components/base/hive-users-provider";
import { Period } from "@/components/schedule/types/event";
import { Box, Chip, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

interface InstructorsFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: Dispatch<SetStateAction<Partial<Period>>>;
}

export default function InstructorsField({ period, onPeriodChange }: InstructorsFieldProps)
{
    const { instructors } = useHiveUsers();

    // Ensure selectedIds is always an array to prevent crashes
    const selectedIds = period?.instructors || [];

    const handleChange = (event: SelectChangeEvent<typeof selectedIds>) =>
    {
        const { target: { value } } = event;

        // Handle potential string autofill values vs actual arrays
        const newIds = typeof value === 'string'
            ? value.split(',').map(Number)
            : value;

        // Use functional update pattern for SetStateAction
        onPeriodChange((prev) => ({
            ...prev,
            instructors: newIds as number[]
        }));
    };

    const handleDelete = (idToDelete: number) =>
    {
        onPeriodChange((prev) => ({
            ...prev,
            instructors: (prev?.instructors || []).filter((id) => id !== idToDelete)
        }));
    };

    return (
        <FormControl fullWidth>
            <InputLabel>מדריכים</InputLabel>
            <Select
                multiple
                label="מדריכים"
                value={ selectedIds }
                onChange={ handleChange }
                renderValue={ (selected) => (
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                        { selected.map((id) =>
                        {
                            // Look up instructor details by ID
                            const instructor = instructors.find((i) => i.id === id);
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
    );
}