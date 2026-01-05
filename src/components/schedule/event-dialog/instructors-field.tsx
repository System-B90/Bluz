import { useHiveUsers } from "@/components/base/hive-users-provider";
import { Period } from "@/components/schedule/types/event";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

interface InstructorsFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function InstructorsField({ period, onPeriodChange }: InstructorsFieldProps)
{
    const { instructors } = useHiveUsers();

    const instructorMenuItems = instructors.map((instructor) => (
        <MenuItem key={ instructor.id } value={ instructor.id }>
            { instructor.display_name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth>
            <InputLabel>מדריכים</InputLabel>
            <Select
                multiple
                value={ period?.instructors || [] }
                label="מדריכים"
                onChange={ (e) => onPeriodChange({ instructors: e.target.value as number[] }) }
            >
                { instructorMenuItems }
            </Select>
        </FormControl>
    );
}