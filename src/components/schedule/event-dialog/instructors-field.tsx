import { DEFAULT_INSTRUCTORS } from "@/components/schedule/types/types";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Period } from "@/components/schedule/types/event";

interface InstructorsFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function InstructorsField({ period, onPeriodChange }: InstructorsFieldProps)
{
    return (
        <FormControl fullWidth>
            <InputLabel>מדריכים</InputLabel>
            <Select
                multiple
                value={ period?.instructors || [] }
                label="מדריכים"
                onChange={ (e) => onPeriodChange({ instructors: e.target.value as string[] }) }
            >
                { DEFAULT_INSTRUCTORS.map((instructor) => (
                    <MenuItem key={ instructor.id } value={ instructor.id }>
                        { instructor.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}