"use client";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    apiCreateOutsider,
    apiDeleteOutsider,
    apiGetOutsiders,
    apiUpdateOutsider,
} from "@/api-client/outsiders";
import { Outsider } from "@/api-shared/types/outsider";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type OutsidersContextState = {
    default: boolean;
    outsiders: Array<Outsider>;
    getOutsider: (id: string) => null | Outsider;
    addOutsider: (outsiderData: Omit<Outsider, "id">) => Promise<void>;
    updateOutsider: (outsider: Outsider) => Promise<void>;
    deleteOutsider: (outsiderId: string) => Promise<void>;
};

const OutsidersContext = createContext<OutsidersContextState>({
    default: true,
    outsiders: [],
    getOutsider: (_id: string) => null,
    addOutsider: async () => {},
    updateOutsider: async () => {},
    deleteOutsider: async () => {},
});

type OutsidersState = {
    outsiders: Record<string, Outsider>;
    isLoading: boolean;
};
type OutsidersAction =
    | { type: "ADD_OUTSIDER"; payload: Outsider }
    | { type: "DELETE_OUTSIDER"; payload: string }
    | { type: "ROLLBACK_OUTSIDERS"; payload: Record<string, Outsider> }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "SET_OUTSIDERS"; payload: Record<string, Outsider> }
    | { type: "UPDATE_OUTSIDER"; payload: Outsider };

function outsidersReducer(
    state: OutsidersState,
    action: OutsidersAction,
): OutsidersState {
    switch (action.type) {
        case "SET_LOADING":
            return { ...state, isLoading: action.payload };
        case "SET_OUTSIDERS":
            return {
                ...state,
                outsiders: action.payload,
                isLoading: false,
            };
        case "ADD_OUTSIDER":
            return {
                ...state,
                outsiders: {
                    ...state.outsiders,
                    [action.payload.id]: action.payload,
                },
            };
        case "UPDATE_OUTSIDER":
            return {
                ...state,
                outsiders: {
                    ...state.outsiders,
                    [action.payload.id]: action.payload,
                },
            };
        case "DELETE_OUTSIDER": {
            const next = { ...state.outsiders };
            delete next[action.payload];
            return {
                ...state,
                outsiders: next,
            };
        }
        case "ROLLBACK_OUTSIDERS":
            return {
                ...state,
                outsiders: action.payload,
            };
        default:
            return state;
    }
}

export const OutsidersProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const { addMessageHandler } = useAuth();
    const [state, dispatch] = useReducer(outsidersReducer, {
        outsiders: {},
        isLoading: true,
    });

    const outsiders = useMemo(
        () => Object.values(state.outsiders),
        [state.outsiders],
    );

    const getOutsider = useCallback(
        (id: string) => {
            return state.outsiders[id] || null;
        },
        [state.outsiders],
    );

    const loadOutsiders = useCallback(() => {
        dispatch({ type: "SET_LOADING", payload: true });
        apiGetOutsiders()
            .then((fetched) => {
                const map: Record<string, Outsider> = {};
                fetched.forEach((o) => {
                    map[o.id] = o;
                });
                dispatch({
                    type: "SET_OUTSIDERS",
                    payload: map,
                });
            })
            .catch((error) => {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת אנשי חוץ נכשלה.",
                    error,
                );
            });
    }, []);

    const addOutsider = useCallback(
        async (outsiderData: Omit<Outsider, "id">) => {
            const id = `outsider-${crypto.randomUUID()}`;
            const outsider: Outsider = {
                id,
                ...outsiderData,
            };
            const previous = { ...state.outsiders };

            dispatch({ type: "ADD_OUTSIDER", payload: outsider });

            try {
                const created = await apiCreateOutsider(outsider);
                enqueueSnackbar(
                    `יצירת איש חוץ ${outsiderData.name} הסתיימה בהצלחה.`,
                    {
                        variant: "success",
                    },
                );
                dispatch({ type: "DELETE_OUTSIDER", payload: id });
                dispatch({ type: "ADD_OUTSIDER", payload: created });
                loadOutsiders();
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_OUTSIDERS",
                    payload: previous,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `יצירת איש חוץ ${outsiderData.name} נכשלה!`,
                    error,
                );
            }
        },
        [state.outsiders, loadOutsiders],
    );

    const updateOutsider = useCallback(
        async (outsider: Outsider) => {
            const previous = { ...state.outsiders };

            dispatch({ type: "UPDATE_OUTSIDER", payload: outsider });

            try {
                const updated = await apiUpdateOutsider(outsider);
                enqueueSnackbar(
                    `עדכון איש חוץ ${outsider.name} הסתיים בהצלחה.`,
                    {
                        variant: "success",
                    },
                );
                dispatch({ type: "UPDATE_OUTSIDER", payload: updated });
                loadOutsiders();
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_OUTSIDERS",
                    payload: previous,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון איש חוץ ${outsider.name} נכשל!`,
                    error,
                );
            }
        },
        [state.outsiders, loadOutsiders],
    );

    const deleteOutsider = useCallback(
        async (outsiderId: string) => {
            const previous = { ...state.outsiders };
            const name = state.outsiders[outsiderId]?.name || outsiderId;

            dispatch({ type: "DELETE_OUTSIDER", payload: outsiderId });

            try {
                await apiDeleteOutsider(outsiderId);
                enqueueSnackbar(`מחיקת איש חוץ ${name} הסתיימה בהצלחה.`, {
                    variant: "success",
                });
                loadOutsiders();
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_OUTSIDERS",
                    payload: previous,
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `מחיקת איש חוץ ${name} נכשלה!`,
                    error,
                );
            }
        },
        [state.outsiders, loadOutsiders],
    );

    useEffect(() => {
        loadOutsiders();
    }, [loadOutsiders]);

    const onWebSocketMessage: MessageHandlerType = useCallback(
        (messageType: MessageTypes, _data: any) => {
            if (messageType === (MessageTypes.OUTSIDERS_UPDATE as any)) {
                loadOutsiders();
            }
        },
        [loadOutsiders],
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        return addMessageHandler(onWebSocketMessage);
    }, [addMessageHandler, onWebSocketMessage]);

    return (
        <OutsidersContext.Provider
            value={{
                default: false,
                outsiders,
                getOutsider,
                addOutsider,
                updateOutsider,
                deleteOutsider,
            }}
        >
            {children}
        </OutsidersContext.Provider>
    );
};

export const useOutsiders = () => {
    const context = useContext(OutsidersContext);

    if (context === undefined || context.default) {
        throw new Error(
            "useOutsiders must be used within an OutsidersProvider",
        );
    }

    return context;
};
