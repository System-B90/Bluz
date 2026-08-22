"use client";
import { enqueueSnackbar } from "notistack";
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";

import
{
    apiCreateCustomColor,
    apiDeleteCustomColor,
    apiGetCustomColors,
    apiUpdateCustomColor,
} from "@/api-client/custom-colors";
import { CustomColor } from "@/api-shared/types/custom-color";
import { useAuth } from "@/components/auth/AuthProvider";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type CustomColorsContextState = {
    default: boolean;
    customColors: Array<CustomColor>;
    isLoading: boolean;
    getCustomColor: (id: string) => CustomColor | null;
    addCustomColor: (colorData: Omit<CustomColor, "id">) => Promise<void>;
    updateCustomColor: (color: CustomColor) => Promise<void>;
    deleteCustomColor: (colorId: string) => Promise<void>;
};

const CustomColorsContext = createContext<CustomColorsContextState>({
    default: true,
    customColors: [],
    isLoading: false,
    getCustomColor: (_id: string) => null,
    addCustomColor: async () => { },
    updateCustomColor: async () => { },
    deleteCustomColor: async () => { },
});

type CustomColorsState = {
    customColors: Record<string, CustomColor>;
    isLoading: boolean;
};
type CustomColorsAction =
    | { type: "ADD_COLOR"; payload: CustomColor; }
    | { type: "DELETE_COLOR"; payload: string; }
    | { type: "ROLLBACK_COLORS"; payload: Record<string, CustomColor>; }
    | { type: "SET_COLORS"; payload: Record<string, CustomColor>; }
    | { type: "SET_LOADING"; payload: boolean; }
    | { type: "UPDATE_COLOR"; payload: CustomColor; };

function customColorsReducer(
    state: CustomColorsState,
    action: CustomColorsAction,
): CustomColorsState
{
    switch (action.type)
    {
    case "SET_LOADING":
        return { ...state, isLoading: action.payload };
    case "SET_COLORS":
        return {
            ...state,
            customColors: action.payload,
            isLoading: false,
        };
    case "ADD_COLOR":
        return {
            ...state,
            customColors: {
                ...state.customColors,
                [ action.payload.id ]: action.payload,
            },
        };
    case "UPDATE_COLOR":
        return {
            ...state,
            customColors: {
                ...state.customColors,
                [ action.payload.id ]: action.payload,
            },
        };
    case "DELETE_COLOR": {
        const next = { ...state.customColors };
        delete next[ action.payload ];
        return {
            ...state,
            customColors: next,
        };
    }
    case "ROLLBACK_COLORS":
        return {
            ...state,
            customColors: action.payload,
        };
    default:
        return state;
    }
}

export const CustomColorsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) =>
{
    const { addMessageHandler } = useAuth();
    const [ state, dispatch ] = useReducer(customColorsReducer, {
        customColors: {},
        isLoading: true,
    });

    const customColors = useMemo(
        () => Object.values(state.customColors),
        [ state.customColors ],
    );

    const getCustomColor = useCallback(
        (id: string) =>
        {
            return state.customColors[ id ] || null;
        },
        [ state.customColors ],
    );

    const loadCustomColors = useCallback(() =>
    {
        dispatch({ type: "SET_LOADING", payload: true });
        apiGetCustomColors()
            .then((fetched) =>
            {
                const map: Record<string, CustomColor> = {};
                fetched.forEach((c) =>
                {
                    map[ c.id ] = c;
                });
                dispatch({
                    type: "SET_COLORS",
                    payload: map,
                });
            })
            .catch((error) =>
            {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת צבעים מותאמים אישית נכשלה.",
                    error,
                );
            });
    }, []);

    /**
     * Undo an optimistic edit whose request failed, then reconcile with the
     * server (#407).
     *
     * The snapshot alone is not a safe resting state: it was taken before the
     * request, so restoring it re-adds colours the server has *already* deleted
     * (the delete failing with "no custom color by id … found" is exactly that
     * case). The list then shows a phantom row, and every later action on it —
     * another delete included — fails against an id that no longer exists. The
     * snapshot restores the UI immediately; the reload is what makes the store
     * converge on what the server actually holds.
     */
    const rollbackAndResync = useCallback(
        (previous: Record<string, CustomColor>) =>
        {
            dispatch({ type: "ROLLBACK_COLORS", payload: previous });
            loadCustomColors();
        },
        [ loadCustomColors ],
    );

    const addCustomColor = useCallback(
        async (colorData: Omit<CustomColor, "id">) =>
        {
            const id = `color-${crypto.randomUUID()}`;
            const color: CustomColor = {
                id,
                ...colorData,
            };
            const previous = { ...state.customColors };

            dispatch({ type: "ADD_COLOR", payload: color });

            try
            {
                const created = await apiCreateCustomColor(color);
                enqueueSnackbar(
                    `יצירת צבע ${colorData.name} הסתיימה בהצלחה.`,
                    { variant: "success" },
                );
                dispatch({ type: "DELETE_COLOR", payload: id });
                dispatch({ type: "ADD_COLOR", payload: created });
                loadCustomColors();
            } catch (error)
            {
                rollbackAndResync(previous);
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `יצירת צבע ${colorData.name} נכשלה!`,
                    error,
                );
            }
        },
        [ state.customColors, loadCustomColors, rollbackAndResync ],
    );

    const updateCustomColor = useCallback(
        async (color: CustomColor) =>
        {
            const previous = { ...state.customColors };

            dispatch({ type: "UPDATE_COLOR", payload: color });

            try
            {
                const updated = await apiUpdateCustomColor(color);
                enqueueSnackbar(
                    `עדכון צבע ${color.name} הסתיים בהצלחה.`,
                    { variant: "success" },
                );
                dispatch({ type: "UPDATE_COLOR", payload: updated });
                loadCustomColors();
            } catch (error)
            {
                rollbackAndResync(previous);
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון צבע ${color.name} נכשל!`,
                    error,
                );
            }
        },
        [ state.customColors, loadCustomColors, rollbackAndResync ],
    );

    const deleteCustomColor = useCallback(
        async (colorId: string) =>
        {
            const previous = { ...state.customColors };
            const name = state.customColors[ colorId ]?.name || colorId;

            dispatch({ type: "DELETE_COLOR", payload: colorId });

            try
            {
                await apiDeleteCustomColor(colorId);
                enqueueSnackbar(`מחיקת צבע ${name} הסתיימה בהצלחה.`, {
                    variant: "success",
                });
                loadCustomColors();
            } catch (error)
            {
                rollbackAndResync(previous);
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `מחיקת צבע ${name} נכשלה!`,
                    error,
                );
            }
        },
        [ state.customColors, loadCustomColors, rollbackAndResync ],
    );

    useEffect(() =>
    {
        loadCustomColors();
    }, [ loadCustomColors ]);

    const onWebSocketMessage: MessageHandlerType = useCallback(
        (messageType: MessageTypes, _data: unknown) =>
        {
            if (messageType === MessageTypes.CUSTOM_COLORS_UPDATE)
            {
                loadCustomColors();
            }
        },
        [ loadCustomColors ],
    );

    useEffect(() =>
    {
        if (typeof window === "undefined")
        {
            return;
        }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    // Memoized: a fresh object here re-renders every consumer of this
    // context on each render of the provider, app-wide.
    const colorsValue = useMemo(
        () => ({
            default: false,
            customColors,
            isLoading: state.isLoading,
            getCustomColor,
            addCustomColor,
            updateCustomColor,
            deleteCustomColor,
        }),
        [
            customColors,
            state.isLoading,
            getCustomColor,
            addCustomColor,
            updateCustomColor,
            deleteCustomColor,
        ],
    );

    return (
        <CustomColorsContext.Provider
            value={colorsValue}
        >
            { children }
        </CustomColorsContext.Provider>
    );
};

export const useCustomColors = () =>
{
    const context = useContext(CustomColorsContext);

    if (context === undefined || context.default)
    {
        throw new Error(
            "useCustomColors must be used within an CustomColorsProvider",
        );
    }

    return context;
};
