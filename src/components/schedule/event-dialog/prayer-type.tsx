import { EventType, Period, PrayerEvent, PrayerType, prayerTypeToHebrew } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";

interface PrayerTypeFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function PrayerTypeField({ period, onPeriodChange, ...props }: PrayerTypeFieldProps & FormControlProps)
{

    const prayerTypeItems = Object.values(PrayerType).map((prayerType) => (
        <MenuItem key={ prayerType } value={ prayerType }>
            { prayerTypeToHebrew(prayerType) }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ period?.type !== EventType.PRAYER } { ...props }>
            <InputLabel>תפילת</InputLabel>
            <Select
                value={ (period as PrayerEvent)?.prayerType || "" }
                label="תפילת"
                onChange={ (e) => onPeriodChange({ prayerType: e.target.value }) }
            >
                { prayerTypeItems }
            </Select>
        </FormControl>
    );
}
