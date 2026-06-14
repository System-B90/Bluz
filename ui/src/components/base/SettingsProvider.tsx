"use client";
import { Dayjs } from "dayjs";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useReducer,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    apiGetPrayerSettings,
    apiSetPrayerSettings,
} from "@/api-client/prayer";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";

export type SettingsContextState = {
    default: boolean;
    prayerTimes: PrayerSettings;
    updatePrayerTimes: (newPrayerTimes: PrayerSettings) => void;
    updatePrayerTime: (key: keyof PrayerSettings, value: Date | Dayjs) => void;
};

const SettingsContext = createContext<SettingsContextState | undefined>({
    default: true,
    prayerTimes: {} as PrayerSettings,
    updatePrayerTimes: (_newPrayerTimes: PrayerSettings) => {},
    updatePrayerTime: (_key: keyof PrayerSettings, _value: Date | Dayjs) => {},
});

type PrayerSettingsState = {
    prayerTimes: PrayerSettings;
    isLoading: boolean;
};
type PrayerSettingsAction =
    | { type: "ROLLBACK_PRAYER_TIMES"; payload: PrayerSettings }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "SET_PRAYER_TIMES"; payload: PrayerSettings }
    | {
          type: "UPDATE_PRAYER_TIME";
          payload: { key: keyof PrayerSettings; value: Date | Dayjs };
      };

function prayerSettingsReducer(
    state: PrayerSettingsState,
    action: PrayerSettingsAction,
): PrayerSettingsState {
    switch (action.type) {
        case "SET_LOADING":
            return { ...state, isLoading: action.payload };
        case "SET_PRAYER_TIMES":
            return { ...state, prayerTimes: action.payload, isLoading: false };
        case "UPDATE_PRAYER_TIME":
            return {
                ...state,
                prayerTimes: {
                    ...state.prayerTimes,
                    [action.payload.key]: action.payload.value,
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
}) => {
    const [state, dispatch] = useReducer(prayerSettingsReducer, {
        prayerTimes: {} as PrayerSettings,
        isLoading: true,
    });

    const loadPrayerSettings = useCallback(() => {
        dispatch({ type: "SET_LOADING", payload: true });
        apiGetPrayerSettings()
            .then((fetchedPrayerSettings) => {
                inplaceDateFixup(fetchedPrayerSettings, "shacharit");
                inplaceDateFixup(fetchedPrayerSettings, "mincha");
                inplaceDateFixup(fetchedPrayerSettings, "arvit");
                dispatch({
                    type: "SET_PRAYER_TIMES",
                    payload: fetchedPrayerSettings,
                });
            })
            .catch((error) => {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הגדרות התפילות נכשלה.",
                    error,
                );
            });
    }, [dispatch]);

    const updatePrayerTimes = useCallback(
        async (newPrayerTimes: PrayerSettings) => {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "SET_PRAYER_TIMES", payload: newPrayerTimes });

            try {
                await apiSetPrayerSettings(newPrayerTimes);
                enqueueSnackbar("שעות תפילה עודכנו בהצלחה.", {
                    variant: "success",
                });
            } catch (error) {
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
        [state.prayerTimes, dispatch],
    );

    const updatePrayerTime = useCallback(
        async (key: keyof PrayerSettings, value: Date | Dayjs) => {
            const previousPrayerTimes = state.prayerTimes;
            dispatch({ type: "UPDATE_PRAYER_TIME", payload: { key, value } });

            const updatedTimes = {
                ...state.prayerTimes,
                [key]: value,
            };

            try {
                await apiSetPrayerSettings(updatedTimes);
                enqueueSnackbar("שעות תפילה עודכנו בהצלחה.", {
                    variant: "success",
                });
            } catch (error) {
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
        [state.prayerTimes, dispatch],
    );

    useEffect(() => {
        loadPrayerSettings();
    }, [loadPrayerSettings]);

    return (
        <SettingsContext.Provider
            value={{
                default: false,
                prayerTimes: state.prayerTimes,
                updatePrayerTimes,
                updatePrayerTime,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);

    if (context === undefined || context.default) {
        throw new Error("useSettings must be used within an SettingsProvider");
    }

    return context;
};
