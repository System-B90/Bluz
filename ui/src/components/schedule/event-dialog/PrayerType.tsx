import { EventType, Event, PrayerEvent, PrayerType, prayerTypeToHebrew } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";

interface PrayerTypeFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<PrayerEvent>) => void;
}

export default function PrayerTypeField({ event, onEventChange, ...props }: PrayerTypeFieldProps & FormControlProps)
{

    const prayerTypeItems = Object.values(PrayerType).map((prayerType) => (
        <MenuItem key={ prayerType } value={ prayerType }>
            { prayerTypeToHebrew(prayerType) }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ event?.type !== EventType.PRAYER } { ...props }>
            <InputLabel>תפילת</InputLabel>
            <Select
                value={ (event as PrayerEvent)?.prayerType || "" }
                label="תפילת"
                onChange={ (e) => onEventChange({ prayerType: e.target.value }) }
            >
                { prayerTypeItems }
            </Select>
        </FormControl>
    );
}
