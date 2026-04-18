'use client';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetPrayerSettings, apiSetPrayerSettings } from '@/api-client/prayer';
import { inplaceDateFixup } from '@/api-shared/date-fixer';
import { PrayerSettings } from '@/api-shared/types/settings/prayer';

export type SettingsContextState = {
    default: boolean;
    prayerTimes: PrayerSettings;
    updatePrayerTimes: (newPrayerTimes: PrayerSettings) => void;
};

const SettingsContext = createContext<SettingsContextState | undefined>({
    default: true,
    prayerTimes: {} as PrayerSettings,
    updatePrayerTimes: (_newPrayerTimes: PrayerSettings) => { },
});

export const SettingsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ prayer, setPrayer ] = useState<PrayerSettings>({} as PrayerSettings);

    const loadPrayerSettings = useCallback(() =>
    {
        apiGetPrayerSettings().then((fetchedPrayerSettings) =>
        {
            inplaceDateFixup(fetchedPrayerSettings, 'shacharit');
            inplaceDateFixup(fetchedPrayerSettings, 'mincha');
            inplaceDateFixup(fetchedPrayerSettings, 'arvit');
            setPrayer(fetchedPrayerSettings);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת הגדרות התפילות נכשלה.', error));
    }, [ setPrayer ]);

    const updatePrayerTimes = useCallback(async (newPrayerTimes: PrayerSettings) =>
    {
        await apiSetPrayerSettings(newPrayerTimes).then(() =>
        {
            enqueueSnackbar('שעות תפילה עודכנו בהצלחה.', { 'variant': 'success' });
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'עדכון שעות תפילה נכשל!', error));
        setPrayer(newPrayerTimes);
    }, [ setPrayer ]);

    useEffect(() =>
    {
        loadPrayerSettings();
    }, [ loadPrayerSettings ]);

    return (
        <SettingsContext.Provider value={ {
            default: false,
            prayerTimes: prayer,
            updatePrayerTimes,

        } }>
            { children }
        </SettingsContext.Provider>
    );
};

export const useSettings = () =>
{
    const context = useContext(SettingsContext);

    if (context === undefined || context.default)
    {
        throw new Error('useSettings must be used within an SettingsProvider');
    }

    return context;
};
