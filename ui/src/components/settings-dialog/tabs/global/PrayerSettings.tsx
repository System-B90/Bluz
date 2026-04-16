import BedtimeIcon from '@mui/icons-material/Bedtime';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useState } from 'react';

import { useSettings } from '@/components/base/SettingsProvider';

export function PrayerSettings()
{
    const { prayerTimes, updatePrayerTimes } = useSettings();

    const getInitialTimes = useCallback(() => ({
        shacharit: prayerTimes?.shacharit ? dayjs(prayerTimes.shacharit) : dayjs().hour(6).minute(0),
        mincha: prayerTimes?.mincha ? dayjs(prayerTimes.mincha) : dayjs().hour(12).minute(0),
        arvit: prayerTimes?.arvit ? dayjs(prayerTimes.arvit) : dayjs().hour(18).minute(0),
    }), [ prayerTimes ]);

    const [ localTimes, setLocalTimes ] = useState(getInitialTimes);

    const handleTimeChange = useCallback((key: keyof typeof localTimes, newValue: Dayjs | null) =>
    {
        setLocalTimes((prev) => ({
            ...prev,
            [ key ]: newValue,
        }));
    }, []);

    const handleSave = useCallback(() =>
    {
        updatePrayerTimes(localTimes);
    }, [ localTimes, updatePrayerTimes ]);

    const handleRestore = useCallback(() =>
    {
        setLocalTimes(getInitialTimes());
    }, [ getInitialTimes ]);

    return (
        <Box border={ 'solid 0.15rem rgba(0,0,0,0.2)' } borderRadius={ 3 } display={ 'flex' } flexDirection={ 'column' } gap={ 1 } padding={ '0.5rem' }>
            <Typography gutterBottom variant="h6">זמני תפילות</Typography>
            <Box display={ 'flex' } flexDirection={ 'column' } gap={ 1 }>
                <TimePicker
                    label="שחרית"
                    onChange={ (newValue) => handleTimeChange('shacharit', newValue) }
                    slots={ { openPickerIcon: WbTwilightIcon } }
                    value={ localTimes.shacharit }
                />
                <TimePicker
                    label="מנחה"
                    onChange={ (newValue) => handleTimeChange('mincha', newValue) }
                    slots={ { openPickerIcon: WbSunnyIcon } }
                    value={ localTimes.mincha }
                />
                <TimePicker
                    label="ערבית"
                    onChange={ (newValue) => handleTimeChange('arvit', newValue) }
                    slots={ { openPickerIcon: BedtimeIcon } }
                    value={ localTimes.arvit }
                />
            </Box>
            <ButtonGroup>
                <Button color="primary" onClick={ handleSave } variant="contained">שמירה</Button>
                <Button color={ 'warning' } onClick={ handleRestore } variant="contained">שחזור</Button>
            </ButtonGroup>
        </Box>
    );
}
