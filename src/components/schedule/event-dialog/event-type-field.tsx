import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { EVENT_TYPES } from "@/components/schedule/types/types";
import { EventType, Period } from "@/components/schedule/types/event";

export interface EventTypeFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (period: Partial<Period>) => void;
}

export default function EventTypeField({ period, onPeriodChange, ...props }: EventTypeFieldProps & FormControlProps)
{
    return (
        <FormControl fullWidth={ false } { ...props }>
            <InputLabel>סוג</InputLabel>
            <Select
                value={ period?.type ?? EventType.EXERCISE }
                label="סוג"
                onChange={ (e) => onPeriodChange({ type: e.target.value }) }
            >
                { EVENT_TYPES.map((type) => (
                    <MenuItem key={ type.value } value={ type.value }>
                        { type.label }
                    </MenuItem>
                )) }
            </Select>
        </FormControl >
    );
}
