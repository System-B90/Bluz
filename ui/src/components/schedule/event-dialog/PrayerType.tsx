import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";

import { Event, EventType, PrayerEvent, PrayerType, prayerTypeToHebrew } from "@/components/schedule/types/event";

interface PrayerTypeFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<PrayerEvent>) => void;
}

export function PrayerTypeField({ event, onEventChange, ...props }: PrayerTypeFieldProps & FormControlProps)
{

    const prayerTypeItems = Object.values(PrayerType).map((prayerType) => (
        <MenuItem key={ prayerType } value={ prayerType }>
            { prayerTypeToHebrew(prayerType) }
        </MenuItem>
    ));

    return (
        <FormControl disabled={ event?.type !== EventType.PRAYER } fullWidth={ false } { ...props }>
            <InputLabel>תפילת</InputLabel>
            <Select
                label="תפילת"
                onChange={ (e) => onEventChange({ prayerType: e.target.value }) }
                value={ (event as PrayerEvent)?.prayerType || "" }
            >
                { prayerTypeItems }
            </Select>
        </FormControl>
    );
}
