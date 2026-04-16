'use client';

import { Box, FormControlLabel, Switch } from '@mui/material';

import { Event } from "@/components/schedule/types/event";

export function EventToggles({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
})
{
    const toggles = [
        { label: 'מתואם', key: 'locked' },
        { label: 'קריטי', key: 'required' },
        { label: 'חלון פ"א', key: 'personalTalk' },
    ] as const;

    return (
        <Box display="flex" gap={ 2 }>
            { toggles.map(({ label, key }) => (
                <FormControlLabel
                    key={ key }
                    label={ label }
                    control={
                        <Switch
                            checked={ !!event[ key ] }
                            onChange={ (e) => onUpdate({ [ key ]: e.target.checked }) }
                        />
                    }
                />
            )) }
        </Box>
    );
}
