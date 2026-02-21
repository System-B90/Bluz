import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { EventType, Period, periodTypeToHebrew } from "@/components/schedule/types/event";

export interface EventTypeFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (period: Partial<Period>) => void;
}

export default function EventTypeField({ period, onPeriodChange, ...props }: EventTypeFieldProps & FormControlProps)
{
    const eventTypes = Object.values(EventType);
    return (
        <FormControl fullWidth={ false } { ...props }>
            <InputLabel>סוג</InputLabel>
            <Select
                value={ period?.type ?? EventType.EXERCISE }
                label="סוג"
                onChange={ (e) => onPeriodChange({ type: e.target.value }) }
            >
                { eventTypes.map((type) => (
                    <MenuItem key={ type } value={ type }>
                        { periodTypeToHebrew(type) }
                    </MenuItem>
                )) }
            </Select>
        </FormControl >
    );
}
