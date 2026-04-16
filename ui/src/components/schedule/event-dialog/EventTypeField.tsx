import { FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useCallback, useState, useRef } from "react";

import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { EventType, eventTypeToHebrew } from "@/components/schedule/types/event";

export interface EventTypeFieldProps extends EventFieldProps { }

export default function EventTypeField({ event, onBlurCallback, ...props }: EventTypeFieldProps & FormControlProps)
{
    const [ currentType, setCurrentType ] = useState<EventType>(event?.type ?? EventType.EXERCISE);

    const latestTypeRef = useRef<EventType>(currentType);
    const eventTypes = Object.values(EventType);

    const onChange = useCallback((ev: SelectChangeEvent<EventType>) =>
    {
        const newType = ev.target.value as EventType;
        setCurrentType(newType);
        latestTypeRef.current = newType;
    }, []);

    const onClose = useCallback(() =>
    {
        onBlurCallback({ type: latestTypeRef.current });
    }, [ onBlurCallback ]);

    return (
        <FormControl fullWidth={ false } { ...props }>
            <InputLabel>סוג</InputLabel>
            <Select
                value={ currentType }
                label="סוג"
                onChange={ onChange }
                onClose={ onClose }
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
