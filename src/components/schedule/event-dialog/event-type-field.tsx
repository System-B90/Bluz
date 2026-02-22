import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { EventType, Event, eventTypeToHebrew } from "@/components/schedule/types/event";

export interface EventTypeFieldProps
{
    event?: Partial<Event>;
    onEventChange: (event: Partial<Event>) => void;
}

export default function EventTypeField({ event, onEventChange, ...props }: EventTypeFieldProps & FormControlProps)
{
    const eventTypes = Object.values(EventType);
    return (
        <FormControl fullWidth={ false } { ...props }>
            <InputLabel>סוג</InputLabel>
            <Select
                value={ event?.type ?? EventType.EXERCISE }
                label="סוג"
                onChange={ (e) => onEventChange({ type: e.target.value }) }
            >
                { eventTypes.map((type) => (
                    <MenuItem key={ type } value={ type }>
                        { eventTypeToHebrew(type) }
                    </MenuItem>
                )) }
            </Select>
        </FormControl >
    );
}
