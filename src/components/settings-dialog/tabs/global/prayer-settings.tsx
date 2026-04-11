import { useSettings } from '@/components/base/settings-provider';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useState } from 'react';

export default function PrayerSettings()
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
        <Box border={ 'solid 0.15rem rgba(0,0,0,0.2)' } padding={ '0.5rem' } borderRadius={ 3 } gap={ 1 } display={ 'flex' } flexDirection={ 'column' }>
            <Typography variant="h6" gutterBottom>זמני תפילות</Typography>
            <Box display={ 'flex' } flexDirection={ 'column' } gap={ 1 }>
                <TimePicker
                    label="שחרית"
                    slots={ { openPickerIcon: WbTwilightIcon } }
                    value={ localTimes.shacharit }
                    onChange={ (newValue) => handleTimeChange('shacharit', newValue) }
                />
                <TimePicker
                    label="מנחה"
                    slots={ { openPickerIcon: WbSunnyIcon } }
                    value={ localTimes.mincha }
                    onChange={ (newValue) => handleTimeChange('mincha', newValue) }
                />
                <TimePicker
                    label="ערבית"
                    slots={ { openPickerIcon: BedtimeIcon } }
                    value={ localTimes.arvit }
                    onChange={ (newValue) => handleTimeChange('arvit', newValue) }
                />
            </Box>
            <ButtonGroup>
                <Button color="primary" variant="contained" onClick={ handleSave }>שמירה</Button>
                <Button color={ 'warning' } variant="contained" onClick={ handleRestore }>שחזור</Button>
            </ButtonGroup>
        </Box>
    );
}