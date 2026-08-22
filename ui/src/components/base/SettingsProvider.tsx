"use client";
import dayjs, { Dayjs } from "dayjs";
import { enqueueSnackbar } from "notistack";
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import
{
    apiGetMealSettings,
    apiSetMealSettings,
} from "@/api-client/meal-settings";
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
import {
    DEFAULT_BREAKFAST_TIME,
    DEFAULT_DINNER_TIME,
    DEFAULT_LUNCH_TIME,
} from "@/api-shared/types/settings/meal";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    DEFAULT_CALENDAR_DAY_END_TIME,
    DEFAULT_CALENDAR_DAY_START_TIME,
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
} from "@/api-shared/types/settings/schedule";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useIterationScope } from "@/components/base/IterationProvider";

// Calendar hours change very rarely, so the last known value is cached in
// localStorage and read synchronously on mount — the calendar renders with
// real bounds immediately instead of flashing the hardcoded defaults while
// the settings API call is in flight.
const CALENDAR_HOURS_CACHE_KEY = "bluz.calendarHours";

type CachedCalendarHours = {
    calendarDayStartTime: string;
    calendarDayEndTime: string;
};

function readCachedCalendarHours(): CachedCalendarHours | null
{
    if (typeof window === "undefined") return null;
    try
    {
        const raw = window.localStorage.getItem(CALENDAR_HOURS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            typeof parsed?.calendarDayStartTime !== "string" ||
            typeof parsed?.calendarDayEndTime !== "string"
        )
        {
            return null;
        }
        return parsed;
    } catch
    {
        return null;
    }
}

function writeCachedCalendarHours(hours: CachedCalendarHours): void
{
    if (typeof window === "undefined") return;
    try
    {
        window.localStorage.setItem(
            CALENDAR_HOURS_CACHE_KEY,
            JSON.stringify(hours),
        );
    } catch
    {
        // Best-effort cache — private browsing / full quota just skips it.
    }
}

export type SettingsContextState = {
    default: boolean;
    prayerTimes: PrayerSettings;
    updatePrayerTimes: (newPrayerTimes: PrayerSettings) => void;
    updatePrayerTime: (key: keyof PrayerSettings, value: Date | Dayjs) => void;
    dayStartTime: string;
    updateDayStartTime: (newDayStartTime: string) => void;
    weekendHomeStartTime: string;
    updateWeekendHomeStartTime: (newWeekendHomeStartTime: string) => void;
    calendarDayStartTime: string;
    updateCalendarDayStartTime: (newCalendarDayStartTime: string) => void;
    calendarDayEndTime: string;
    updateCalendarDayEndTime: (newCalendarDayEndTime: string) => void;
    breakfastTime: string;
    updateBreakfastTime: (newBreakfastTime: string) => void;
    lunchTime: string;
    updateLunchTime: (newLunchTime: string) => void;
    dinnerTime: string;
    updateDinnerTime: (newDinnerTime: string) => void;
    /** True while viewing a past iteration — its settings are read-only. */
    isReadOnlyIteration: boolean;
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
    calendarDayStartTime: DEFAULT_CALENDAR_DAY_START_TIME,
    updateCalendarDayStartTime: (_newCalendarDayStartTime: string) => { },
    calendarDayEndTime: DEFAULT_CALENDAR_DAY_END_TIME,
    updateCalendarDayEndTime: (_newCalendarDayEndTime: string) => { },
    breakfastTime: DEFAULT_BREAKFAST_TIME,
    updateBreakfastTime: (_newBreakfastTime: string) => { },
    lunchTime: DEFAULT_LUNCH_TIME,
    updateLunchTime: (_newLunchTime: string) => { },
    dinnerTime: DEFAULT_DINNER_TIME,
    updateDinnerTime: (_newDinnerTime: string) => { },
    isReadOnlyIteration: false,
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
    // Settings live in the iteration's own database, so every call is scoped
    // to the active iteration and reloaded whenever it changes.
    const { iterationId, isReadOnlyIteration } = useIterationScope();

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
        apiGetPrayerSettings(iterationId)
            .then((fetchedPrayerSettings) =>
            {
                // Only the default database is seeded at startup, so an
                // iteration that never had prayer times returns null — keep
                // the defaults rather than choking on the date fixup.
                if (!fetchedPrayerSettings)
                {
                    dispatch({ type: "SET_LOADING", payload: false });
                    return;
                }
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
    }, [ dispatch, iterationId ]);

    /**
     * Persist an already-dispatched optimistic prayer-times change, rolling the
     * reducer back to `previous` if the server rejects it.
     */
    const persistPrayerTimes = useCallback(
        async (nextTimes: PrayerSettings, previous: PrayerSettings) =>
        {
            try
            {
                await apiSetPrayerSettings(nextTimes, iterationId);
                enqueueSnackbar("שעות תפילה עודכנו בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                dispatch({
                    type: "ROLLBACK_PRAYER_TIMES",
                    payload: previous,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעות תפילה נכשל!",
                    error,
                );
            }
        },
        [ dispatch, iterationId ],
    );

    const updatePrayerTimes = useCallback(
        async (newPrayerTimes: PrayerSettings) =>
        {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "SET_PRAYER_TIMES", payload: newPrayerTimes });
            await persistPrayerTimes(newPrayerTimes, previousPrayerTimes);
        },
        [ state.prayerTimes, dispatch, persistPrayerTimes ],
    );

    const updatePrayerTime = useCallback(
        async (key: keyof PrayerSettings, value: Date | Dayjs) =>
        {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "UPDATE_PRAYER_TIME", payload: { key, value } });
            await persistPrayerTimes(
                { ...state.prayerTimes, [ key ]: value },
                previousPrayerTimes,
            );
        },
        [ state.prayerTimes, dispatch, persistPrayerTimes ],
    );

    const [ dayStartTime, setDayStartTime ] = useState<string>(
        DEFAULT_DAY_START_TIME,
    );
    const [ weekendHomeStartTime, setWeekendHomeStartTime ] = useState<string>(
        DEFAULT_WEEKEND_HOME_START_TIME,
    );
    const [ cachedCalendarHours ] = useState(readCachedCalendarHours);
    const [ calendarDayStartTime, setCalendarDayStartTime ] = useState<string>(
        cachedCalendarHours?.calendarDayStartTime ?? DEFAULT_CALENDAR_DAY_START_TIME,
    );
    const [ calendarDayEndTime, setCalendarDayEndTime ] = useState<string>(
        cachedCalendarHours?.calendarDayEndTime ?? DEFAULT_CALENDAR_DAY_END_TIME,
    );

    // Each update function used to build its apiSetScheduleSettings payload
    // from the render-closure values of the *other* three fields. Two rapid
    // saves (e.g. dayStartTime then weekendHomeStartTime before the first
    // request's state update has committed) would each read the same stale
    // snapshot and the second request would silently overwrite the first
    // request's field with the pre-change value. A ref updated synchronously
    // alongside every optimistic setState always reflects the latest known
    // values regardless of React's commit timing.
    const scheduleSettingsRef = useRef({
        dayStartTime,
        weekendHomeStartTime,
        calendarDayStartTime,
        calendarDayEndTime,
    });

    const loadScheduleSettings = useCallback(() =>
    {
        apiGetScheduleSettings(iterationId)
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

                const nextCalendarDayStartTime =
                    fetchedScheduleSettings?.calendarDayStartTime ??
                        DEFAULT_CALENDAR_DAY_START_TIME;
                const nextCalendarDayEndTime =
                    fetchedScheduleSettings?.calendarDayEndTime ??
                        DEFAULT_CALENDAR_DAY_END_TIME;
                setCalendarDayStartTime(nextCalendarDayStartTime);
                setCalendarDayEndTime(nextCalendarDayEndTime);
                writeCachedCalendarHours({
                    calendarDayStartTime: nextCalendarDayStartTime,
                    calendarDayEndTime: nextCalendarDayEndTime,
                });
                scheduleSettingsRef.current = {
                    dayStartTime:
                        fetchedScheduleSettings?.dayStartTime ??
                            DEFAULT_DAY_START_TIME,
                    weekendHomeStartTime:
                        fetchedScheduleSettings?.weekendHomeStartTime ??
                            DEFAULT_WEEKEND_HOME_START_TIME,
                    calendarDayStartTime: nextCalendarDayStartTime,
                    calendarDayEndTime: nextCalendarDayEndTime,
                };
            })
            .catch((error) =>
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הגדרות הלו\"ז נכשלה.",
                    error,
                );
            });
    }, [ setDayStartTime, setWeekendHomeStartTime, setCalendarDayStartTime, setCalendarDayEndTime, iterationId ]);

    const updateDayStartTime = useCallback(
        async (newDayStartTime: string) =>
        {
            const previous = scheduleSettingsRef.current;
            setDayStartTime(newDayStartTime);
            scheduleSettingsRef.current = {
                ...previous,
                dayStartTime: newDayStartTime,
            };

            try
            {
                await apiSetScheduleSettings(
                    scheduleSettingsRef.current,
                    iterationId,
                );
                enqueueSnackbar('שעת תחילת יום ברירת מחדל עודכנה בהצלחה.', {
                    variant: "success",
                });
            } catch (error)
            {
                setDayStartTime(previous.dayStartTime);
                scheduleSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    'עדכון שעת תחילת יום ברירת מחדל נכשל!',
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const updateWeekendHomeStartTime = useCallback(
        async (newWeekendHomeStartTime: string) =>
        {
            const previous = scheduleSettingsRef.current;
            setWeekendHomeStartTime(newWeekendHomeStartTime);
            scheduleSettingsRef.current = {
                ...previous,
                weekendHomeStartTime: newWeekendHomeStartTime,
            };

            try
            {
                await apiSetScheduleSettings(
                    scheduleSettingsRef.current,
                    iterationId,
                );
                enqueueSnackbar('שעת תחילת לו"ז אחרי סופ"ש עודכנה בהצלחה.', {
                    variant: "success",
                });
            } catch (error)
            {
                setWeekendHomeStartTime(previous.weekendHomeStartTime);
                scheduleSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    'עדכון שעת תחילת לו"ז אחרי סופ"ש נכשל!',
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const updateCalendarDayStartTime = useCallback(
        async (newCalendarDayStartTime: string) =>
        {
            const previous = scheduleSettingsRef.current;
            setCalendarDayStartTime(newCalendarDayStartTime);
            writeCachedCalendarHours({
                calendarDayStartTime: newCalendarDayStartTime,
                calendarDayEndTime: previous.calendarDayEndTime,
            });
            scheduleSettingsRef.current = {
                ...previous,
                calendarDayStartTime: newCalendarDayStartTime,
            };

            try
            {
                await apiSetScheduleSettings(
                    scheduleSettingsRef.current,
                    iterationId,
                );
                enqueueSnackbar("שעת תחילת יום ביומן עודכנה בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                setCalendarDayStartTime(previous.calendarDayStartTime);
                writeCachedCalendarHours({
                    calendarDayStartTime: previous.calendarDayStartTime,
                    calendarDayEndTime: previous.calendarDayEndTime,
                });
                scheduleSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעת תחילת יום ביומן נכשל!",
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const updateCalendarDayEndTime = useCallback(
        async (newCalendarDayEndTime: string) =>
        {
            const previous = scheduleSettingsRef.current;
            setCalendarDayEndTime(newCalendarDayEndTime);
            writeCachedCalendarHours({
                calendarDayStartTime: previous.calendarDayStartTime,
                calendarDayEndTime: newCalendarDayEndTime,
            });
            scheduleSettingsRef.current = {
                ...previous,
                calendarDayEndTime: newCalendarDayEndTime,
            };

            try
            {
                await apiSetScheduleSettings(
                    scheduleSettingsRef.current,
                    iterationId,
                );
                enqueueSnackbar("שעת סיום יום ביומן עודכנה בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                setCalendarDayEndTime(previous.calendarDayEndTime);
                writeCachedCalendarHours({
                    calendarDayStartTime: previous.calendarDayStartTime,
                    calendarDayEndTime: previous.calendarDayEndTime,
                });
                scheduleSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעת סיום יום ביומן נכשל!",
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const [ breakfastTime, setBreakfastTime ] = useState<string>(
        DEFAULT_BREAKFAST_TIME,
    );
    const [ lunchTime, setLunchTime ] = useState<string>(DEFAULT_LUNCH_TIME);
    const [ dinnerTime, setDinnerTime ] = useState<string>(DEFAULT_DINNER_TIME);

    // Same rapid-double-save hazard as scheduleSettingsRef above: read/write
    // the latest known values via a ref instead of the render-closure state.
    const mealSettingsRef = useRef({ breakfastTime, lunchTime, dinnerTime });

    const loadMealSettings = useCallback(() =>
    {
        apiGetMealSettings(iterationId)
            .then((fetchedMealSettings) =>
            {
                const nextBreakfastTime =
                    fetchedMealSettings?.breakfastTime ??
                        DEFAULT_BREAKFAST_TIME;
                const nextLunchTime =
                    fetchedMealSettings?.lunchTime ?? DEFAULT_LUNCH_TIME;
                const nextDinnerTime =
                    fetchedMealSettings?.dinnerTime ?? DEFAULT_DINNER_TIME;
                setBreakfastTime(nextBreakfastTime);
                setLunchTime(nextLunchTime);
                setDinnerTime(nextDinnerTime);
                mealSettingsRef.current = {
                    breakfastTime: nextBreakfastTime,
                    lunchTime: nextLunchTime,
                    dinnerTime: nextDinnerTime,
                };
            })
            .catch((error) =>
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הגדרות זמני ארוחות נכשלה.",
                    error,
                );
            });
    }, [ setBreakfastTime, setLunchTime, setDinnerTime, iterationId ]);

    const updateBreakfastTime = useCallback(
        async (newBreakfastTime: string) =>
        {
            const previous = mealSettingsRef.current;
            setBreakfastTime(newBreakfastTime);
            mealSettingsRef.current = {
                ...previous,
                breakfastTime: newBreakfastTime,
            };

            try
            {
                await apiSetMealSettings(mealSettingsRef.current, iterationId);
                enqueueSnackbar("שעת ארוחת בוקר עודכנה בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                setBreakfastTime(previous.breakfastTime);
                mealSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעת ארוחת בוקר נכשל!",
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const updateLunchTime = useCallback(
        async (newLunchTime: string) =>
        {
            const previous = mealSettingsRef.current;
            setLunchTime(newLunchTime);
            mealSettingsRef.current = { ...previous, lunchTime: newLunchTime };

            try
            {
                await apiSetMealSettings(mealSettingsRef.current, iterationId);
                enqueueSnackbar("שעת ארוחת צהריים עודכנה בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                setLunchTime(previous.lunchTime);
                mealSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעת ארוחת צהריים נכשל!",
                    error,
                );
            }
        },
        [ iterationId ],
    );

    const updateDinnerTime = useCallback(
        async (newDinnerTime: string) =>
        {
            const previous = mealSettingsRef.current;
            setDinnerTime(newDinnerTime);
            mealSettingsRef.current = { ...previous, dinnerTime: newDinnerTime };

            try
            {
                await apiSetMealSettings(mealSettingsRef.current, iterationId);
                enqueueSnackbar("שעת ארוחת ערב עודכנה בהצלחה.", {
                    variant: "success",
                });
            } catch (error)
            {
                setDinnerTime(previous.dinnerTime);
                mealSettingsRef.current = previous;
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שעת ארוחת ערב נכשל!",
                    error,
                );
            }
        },
        [ iterationId ],
    );

    useEffect(() =>
    {
        loadPrayerSettings();
        loadScheduleSettings();
        loadMealSettings();
    }, [ loadPrayerSettings, loadScheduleSettings, loadMealSettings ]);

    // Memoized: a fresh object here re-renders every consumer of this
    // context on each render of the provider, app-wide.
    const settingsValue = useMemo(
        () => ({
            default: false,
            prayerTimes: state.prayerTimes,
            updatePrayerTimes,
            updatePrayerTime,
            dayStartTime,
            updateDayStartTime,
            weekendHomeStartTime,
            updateWeekendHomeStartTime,
            calendarDayStartTime,
            updateCalendarDayStartTime,
            calendarDayEndTime,
            updateCalendarDayEndTime,
            breakfastTime,
            updateBreakfastTime,
            lunchTime,
            updateLunchTime,
            dinnerTime,
            updateDinnerTime,
            isReadOnlyIteration,
        }),
        [
            state.prayerTimes,
            updatePrayerTimes,
            updatePrayerTime,
            dayStartTime,
            updateDayStartTime,
            weekendHomeStartTime,
            updateWeekendHomeStartTime,
            calendarDayStartTime,
            updateCalendarDayStartTime,
            calendarDayEndTime,
            updateCalendarDayEndTime,
            breakfastTime,
            updateBreakfastTime,
            lunchTime,
            updateLunchTime,
            dinnerTime,
            updateDinnerTime,
            isReadOnlyIteration,
        ],
    );

    return (
        <SettingsContext.Provider
            value={settingsValue}
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
