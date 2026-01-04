import { DEFAULT_SUBJECTS } from "@/components/schedule/types/types";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Period } from "@/components/schedule/types/event";

interface SubjectFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function SubjectField({ period, onPeriodChange }: SubjectFieldProps)
{
    return (
        <FormControl fullWidth>
            <InputLabel>Subject</InputLabel>
            <Select
                value={ period?.subject || "" }
                label="Subject"
                onChange={ (e) => onPeriodChange({ subject: e.target.value }) }
            >
                { DEFAULT_SUBJECTS.map((subject) => (
                    <MenuItem key={ subject.id } value={ subject.id }>
                        { subject.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}