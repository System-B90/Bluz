'use client';

import EventTimeField from "@/components/schedule/event-dialog/TimeFields";
import { Event } from "@/components/schedule/types/event";
import { Box, TextField } from '@mui/material';

export function EventPrimaryDetails({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
})
{
    return (
        <>
            <Box gap={ 2 } display="flex" width="100%">
                <TextField
                    label="שם"
                    fullWidth
                    required
                    value={ event.name ?? '' }
                    onChange={ (e) => onUpdate({ name: e.target.value }) }
                    sx={ { flexGrow: 1 } }
                />
                <EventTimeField
                    sx={ { flexShrink: 1 } }
                    event={ event }
                    onBlurCallback={ onUpdate }
                />
            </Box>

            <TextField
                label="הערות"
                fullWidth
                multiline
                rows={ 3 }
                value={ event.notes ?? '' }
                onChange={ (e) => onUpdate({ notes: e.target.value }) }
            />
        </>
    );
}
