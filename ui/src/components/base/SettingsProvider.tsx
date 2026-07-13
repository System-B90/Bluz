"use client";
import dayjs, { Dayjs } from "dayjs";
import { enqueueSnackbar } from "notistack";
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useState,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import
{
    apiGetPrayerSettings,
    apiSetPrayerSettings,
} from "@/api-client/prayer";
import
{
    apiGetScheduleSettings,
    apiSetScheduleSettings,
} from "@/api-client/schedule-settings";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
} from "@/api-shared/types/settings/schedule";

export type SettingsContextState = {
    default: boolean;
    prayerTimes: PrayerSettings;
    updatePrayerTimes: (newPrayerTimes: PrayerSettings) => void;
    updatePrayerTime: (key: keyof PrayerSettings, value: Date | Dayjs) => void;
    dayStartTime: string;
    updateDayStartTime: (newDayStartTime: string) => void;
    weekendHomeStartTime: string;
    updateWeekendHomeStartTime: (newWeekendHomeStartTime: string) => void;
};

const SettingsContext = createContext<SettingsContextState | undefined>({
    default: true,
    prayerTimes: {} as PrayerSettings,
    updatePrayerTimes: (_newPrayerTimes: PrayerSettings) => { },
    updatePrayerTime: (_key: keyof PrayerSettings, _value: Date | Dayjs) => { },
    dayStartTime: DEFAULT_DAY_START_TIME,
    updateDayStartTime: (_newDayStartTime: string) => { },
    weekendHomeStartTime: DEFAULT_WEEKEND_HOME_START_TIME,
    updateWeekendHomeStartTime: (_newWeekendHomeStartTime: string) => { },
});

type PrayerSettingsState = {
    prayerTimes: PrayerSettings;
    isLoading: boolean;
};
type PrayerSettingsAction =
    | { type: "ROLLBACK_PRAYER_TIMES"; payload: PrayerSettings; }
    | { type: "SET_LOADING"; payload: boolean; }
    | { type: "SET_PRAYER_TIMES"; payload: PrayerSettings; }
    | {
        type: "UPDATE_PRAYER_TIME";
        payload: { key: keyof PrayerSettings; value: Date | Dayjs; };
    };

function prayerSettingsReducer(
    state: PrayerSettingsState,
    action: PrayerSettingsAction,
): PrayerSettingsState
{
    switch (action.type)
    {
    case "SET_LOADING":
        return { ...state, isLoading: action.payload };
    case "SET_PRAYER_TIMES":
        return { ...state, prayerTimes: action.payload, isLoading: false };
    case "UPDATE_PRAYER_TIME":
        return {
            ...state,
            prayerTimes: {
                ...state.prayerTimes,
                [ action.payload.key ]: action.payload.value,
            },
        };
    case "ROLLBACK_PRAYER_TIMES":
        return { ...state, prayerTimes: action.payload };
    default:
        return state;
    }
}

export const SettingsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) =>
{
    const [ state, dispatch ] = useReducer(prayerSettingsReducer, {
        prayerTimes: {
            shacharit: dayjs().hour(6),
            mincha: dayjs().hour(12),
            arvit: dayjs().hour(18),
        },
        isLoading: true,
    });

    const loadPrayerSettings = useCallback(() =>
    {
        dispatch({ type: "SET_LOADING", payload: true });
        apiGetPrayerSettings()
            .then((fetchedPrayerSettings) =>
            {
                inplaceDateFixup(fetchedPrayerSettings, "shacharit");
                inplaceDateFixup(fetchedPrayerSettings, "mincha");
                inplaceDateFixup(fetchedPrayerSettings, "arvit");
                dispatch({
                    type: "SET_PRAYER_TIMES",
                    payload: fetchedPrayerSettings,
                });
            })
            .catch((error) =>
            {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הגדרות התפילות נכשלה.",
                    error,
                );
            });
    }, [ dispatch ]);

    const updatePrayerTimes = useCallback(
        async (newPrayerTimes: PrayerSettings) =>
        {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "SET_PRAYER_TIMES", payload: newPrayerTimes });

            try
            {
                await apiSetPrayerSettings(newPrayerTimes);
                enqueueSnackbar("שעות תפילה עודכנו בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                dispatch({
                    type: "ROLLBACK_PRAYER_TIMES",
                    payload: previousPrayerTimes,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעות תפילה נכשל!",
                    error,
                );
            }
        },
        [ state.prayerTimes, dispatch ],
    );

    const updatePrayerTime = useCallback(
        async (key: keyof PrayerSettings, value: Date | Dayjs) =>
        {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "UPDATE_PRAYER_TIME", payload: { key, value } });

            const updatedTimes = {
                ...state.prayerTimes,
                [ key ]: value,
            };

            try
            {
                await apiSetPrayerSettings(updatedTimes);
                enqueueSnackbar("שעות תפילה עודכנו בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                dispatch({
                    type: "ROLLBACK_PRAYER_TIMES",
                    payload: previousPrayerTimes,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעות תפילה נכשל!",
                    error,
                );
            }
        },
        [ state.prayerTimes, dispatch ],
    );

    const [ dayStartTime, setDayStartTime ] = useState<string>(
        DEFAULT_DAY_START_TIME,
    );
    const [ weekendHomeStartTime, setWeekendHomeStartTime ] = useState<string>(
        DEFAULT_WEEKEND_HOME_START_TIME,
    );

    const loadScheduleSettings = useCallback(() =>
    {
        apiGetScheduleSettings()
            .then((fetchedScheduleSettings) =>
            {
                setDayStartTime(
                    fetchedScheduleSettings?.dayStartTime ??
                        DEFAULT_DAY_START_TIME,
                );
                setWeekendHomeStartTime(
                    fetchedScheduleSettings?.weekendHomeStartTime ??
                        DEFAULT_WEEKEND_HOME_START_TIME,
                );
            })
            .catch((error) =>
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הגדרות הלו\"ז נכשלה.",
                    error,
                );
            });
    }, [ setDayStartTime, setWeekendHomeStartTime ]);

    const updateDayStartTime = useCallback(
        async (newDayStartTime: string) =>
        {
            const previousDayStartTime = dayStartTime;
            setDayStartTime(newDayStartTime);

            try
            {
                await apiSetScheduleSettings({
                    dayStartTime: newDayStartTime,
                    weekendHomeStartTime,
                });
                enqueueSnackbar('שעת תחילת יום ברירת מחדל עודכנה בהצלחה.', {
                    variant: "success",
                });
            } catch (error)
            {
                setDayStartTime(previousDayStartTime);
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    'עדכון שעת תחילת יום ברירת מחדל נכשל!',
                    error,
                );
            }
        },
        [ dayStartTime, weekendHomeStartTime ],
    );

    const updateWeekendHomeStartTime = useCallback(
        async (newWeekendHomeStartTime: string) =>
        {
            const previousWeekendHomeStartTime = weekendHomeStartTime;
            setWeekendHomeStartTime(newWeekendHomeStartTime);

            try
            {
                await apiSetScheduleSettings({
                    dayStartTime,
                    weekendHomeStartTime: newWeekendHomeStartTime,
                });
                enqueueSnackbar('שעת תחילת לו"ז אחרי סופ"ש עודכנה בהצלחה.', {
                    variant: "success",
                });
            } catch (error)
            {
                setWeekendHomeStartTime(previousWeekendHomeStartTime);
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    'עדכון שעת תחילת לו"ז אחרי סופ"ש נכשל!',
                    error,
                );
            }
        },
        [ dayStartTime, weekendHomeStartTime ],
    );

    useEffect(() =>
    {
        loadPrayerSettings();
        loadScheduleSettings();
    }, [ loadPrayerSettings, loadScheduleSettings ]);

    return (
        <SettingsContext.Provider
            value={ {
                default: false,
                prayerTimes: state.prayerTimes,
                updatePrayerTimes,
                updatePrayerTime,
                dayStartTime,
                updateDayStartTime,
                weekendHomeStartTime,
                updateWeekendHomeStartTime,
            } }
        >
            { children }
        </SettingsContext.Provider>
    );
};

export const useSettings = () =>
{
    const context = useContext(SettingsContext);

    if (context === undefined || context.default)
    {
        throw new Error("useSettings must be used within an SettingsProvider");
    }

    return context;
};
