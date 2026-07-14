"use client";
import { useSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

type ItemMap<T> = Record<string, T>;
type CollectionState<T> = {
    items: ItemMap<T>;
    isLoading: boolean;
};
type CollectionAction<T> =
    | { type: "PATCH_ITEM"; payload: { key: string; changes: Partial<T> } }
    | { type: "PUT_ITEM"; payload: { key: string; item: T } }
    | { type: "REMOVE_ITEM"; payload: string }
    | { type: "ROLLBACK"; payload: ItemMap<T> }
    | { type: "SET_ITEMS"; payload: ItemMap<T> }
    | { type: "SET_LOADING"; payload: boolean };

function collectionReducer<T>(
    state: CollectionState<T>,
    action: CollectionAction<T>,
): CollectionState<T> {
    switch (action.type) {
    case "SET_LOADING":
        return { ...state, isLoading: action.payload };
    case "SET_ITEMS":
        return { items: action.payload, isLoading: false };
    case "ROLLBACK":
        return { ...state, items: action.payload };
    case "PUT_ITEM":
        return {
            ...state,
            items: {
                ...state.items,
                [action.payload.key]: action.payload.item,
            },
        };
    case "PATCH_ITEM": {
        const existing = state.items[action.payload.key];
        if (!existing) return state;
        return {
            ...state,
            items: {
                ...state.items,
                [action.payload.key]: {
                    ...existing,
                    ...action.payload.changes,
                },
            },
        };
    }
    case "REMOVE_ITEM": {
        const next = { ...state.items };
        delete next[action.payload];
        return { ...state, items: next };
    }
    default:
        return state;
    }
}

/** Optimistic edits a mutation applies to the store before the request runs. */
export type CollectionOps<T> = {
    put: (key: string, item: T) => void;
    patch: (key: string, changes: Partial<T>) => void;
    remove: (key: string) => void;
};

export type CollectionMutation<T> = {
    optimistic: (ops: CollectionOps<T>) => void;
    request: () => Promise<void>;
    successMessage: string;
    failureMessage: string;
};

export type CollectionApi<T, TId> = {
    list: () => Promise<Array<T>>;
    create: (item: T) => Promise<T>;
    update: (item: T) => Promise<T>;
    remove: (id: TId) => Promise<void>;
};

export type CollectionConfig<T, TId, TCreate> = {
    api: CollectionApi<T, TId>;
    /** Stable store key. May be composite (e.g. rooms key on `source:id`). */
    getKey: (item: T) => string;
    getId: (item: T) => TId;
    /** Human-readable name used in the Hebrew snackbar texts. */
    getLabel: (item: T) => string;
    /** Builds the optimistic item — including its temporary id — from form data. */
    buildItem: (data: TCreate) => T;
    messages: {
        loadFailed: string;
        createSuccess: (label: string) => string;
        createFailure: (label: string) => string;
        updateSuccess: (label: string) => string;
        updateFailure: (label: string) => string;
        deleteSuccess: (label: string) => string;
        deleteFailure: (label: string) => string;
    };
    websocket: {
        messageType: MessageTypes;
        /**
         * Field on the WS payload holding an incremental `id -> item | null` map.
         * Omit it — or send a payload without the field — to force a full reload.
         */
        payloadKey?: string;
        /** Maps an id from the incremental WS map to a store key. Defaults to the id. */
        keyOf?: (id: string, item: null | T) => string;
    };
};

export type CollectionContextState<T, TCreate> = {
    default: boolean;
    items: Array<T>;
    isLoading: boolean;
    getItem: (key: string) => T | undefined;
    addItem: (data: TCreate) => Promise<void>;
    updateItem: (item: T) => Promise<void>;
    /** Merges `changes` into the stored item and persists the merged result. */
    patchItem: (key: string, changes: Partial<T>) => Promise<void>;
    deleteItem: (key: string) => Promise<void>;
    /** Escape hatch for collection-specific writes (e.g. room extended info). */
    mutate: (mutation: CollectionMutation<T>) => Promise<void>;
};

/**
 * Builds an optimistic-CRUD-with-rollback provider around a REST collection:
 * loads on mount, applies edits locally, rolls the whole map back when the
 * request fails, and keeps itself fresh from a websocket update message.
 */
export function createCollectionProvider<T, TId, TCreate>(
    config: CollectionConfig<T, TId, TCreate>,
) {
    const { api, getKey, getId, getLabel, buildItem, messages, websocket } =
        config;
    const wsKeyOf = websocket.keyOf ?? ((id: string) => id);

    const Context = createContext<CollectionContextState<T, TCreate>>({
        default: true,
        items: [],
        isLoading: true,
        getItem: () => undefined,
        addItem: async () => {},
        updateItem: async () => {},
        patchItem: async () => {},
        deleteItem: async () => {},
        mutate: async () => {},
    });

    const Provider = ({ children }: { children: React.ReactNode }) => {
        const { addMessageHandler } = useAuth();
        const { enqueueSnackbar } = useSnackbar();
        const [state, dispatch] = useReducer(
            collectionReducer<T>,
            { items: {}, isLoading: true } as CollectionState<T>,
        );

        // Snapshot source for rollbacks. Keeping it in a ref — instead of in the
        // callback deps — is what stops every mutation callback (and the context
        // value) from being rebuilt on each item change.
        const itemsRef = useRef(state.items);
        useEffect(() => {
            itemsRef.current = state.items;
        }, [state.items]);

        const ops: CollectionOps<T> = useMemo(
            () => ({
                put: (key, item) =>
                    dispatch({ type: "PUT_ITEM", payload: { key, item } }),
                patch: (key, changes) =>
                    dispatch({ type: "PATCH_ITEM", payload: { key, changes } }),
                remove: (key) => dispatch({ type: "REMOVE_ITEM", payload: key }),
            }),
            [],
        );

        const mutate = useCallback(
            async ({
                optimistic,
                request,
                successMessage,
                failureMessage,
            }: CollectionMutation<T>) => {
                const snapshot = itemsRef.current;
                optimistic(ops);
                try {
                    await request();
                    enqueueSnackbar(successMessage, { variant: "success" });
                } catch (error) {
                    dispatch({ type: "ROLLBACK", payload: snapshot });
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        failureMessage,
                        error,
                    );
                }
            },
            [ops, enqueueSnackbar],
        );

        const load = useCallback(() => {
            dispatch({ type: "SET_LOADING", payload: true });
            api.list()
                .then((fetched) => {
                    const map: ItemMap<T> = {};
                    fetched.forEach((item) => {
                        map[getKey(item)] = item;
                    });
                    dispatch({ type: "SET_ITEMS", payload: map });
                })
                .catch((error) => {
                    dispatch({ type: "SET_LOADING", payload: false });
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        messages.loadFailed,
                        error,
                    );
                });
        }, [enqueueSnackbar]);

        const addItem = useCallback(
            async (data: TCreate) => {
                const item = buildItem(data);
                const tempKey = getKey(item);
                const label = getLabel(item);

                await mutate({
                    optimistic: (o) => o.put(tempKey, item),
                    request: async () => {
                        const created = await api.create(item);
                        ops.remove(tempKey);
                        ops.put(getKey(created), created);
                    },
                    successMessage: messages.createSuccess(label),
                    failureMessage: messages.createFailure(label),
                });
            },
            [mutate, ops],
        );

        const updateItem = useCallback(
            async (item: T) => {
                const key = getKey(item);
                const label = getLabel(item);

                await mutate({
                    optimistic: (o) => o.put(key, item),
                    request: async () => {
                        const updated = await api.update(item);
                        ops.put(getKey(updated), updated);
                    },
                    successMessage: messages.updateSuccess(label),
                    failureMessage: messages.updateFailure(label),
                });
            },
            [mutate, ops],
        );

        const patchItem = useCallback(
            async (key: string, changes: Partial<T>) => {
                const existing = itemsRef.current[key];
                if (!existing) return;
                await updateItem({ ...existing, ...changes });
            },
            [updateItem],
        );

        const deleteItem = useCallback(
            async (key: string) => {
                const existing = itemsRef.current[key];
                if (!existing) return;
                const label = getLabel(existing);

                await mutate({
                    optimistic: (o) => o.remove(key),
                    request: () => api.remove(getId(existing)),
                    successMessage: messages.deleteSuccess(label),
                    failureMessage: messages.deleteFailure(label),
                });
            },
            [mutate],
        );

        useEffect(() => {
            load();
        }, [load]);

        const onWebSocketMessage: MessageHandlerType = useCallback(
            (messageType: MessageTypes, data: any) => {
                if (messageType !== websocket.messageType) return;

                const incremental =
                    websocket.payloadKey && data?.[websocket.payloadKey];
                if (!incremental) {
                    // Unknown or non-incremental payload — fall back to a full reload.
                    load();
                    return;
                }

                Object.entries(incremental as Record<string, null | T>).forEach(
                    ([id, item]) => {
                        const key = wsKeyOf(id, item);
                        if (item === null) {
                            ops.remove(key);
                        } else {
                            ops.put(key, item);
                        }
                    },
                );
            },
            [load, ops],
        );

        useEffect(() => {
            if (typeof window === "undefined") {
                return;
            }

            return addMessageHandler(onWebSocketMessage);
        }, [addMessageHandler, onWebSocketMessage]);

        const items = useMemo(
            () => Object.values(state.items),
            [state.items],
        );

        const getItem = useCallback(
            (key: string) => state.items[key],
            [state.items],
        );

        const contextValue = useMemo(
            () => ({
                default: false as const,
                items,
                isLoading: state.isLoading,
                getItem,
                addItem,
                updateItem,
                patchItem,
                deleteItem,
                mutate,
            }),
            [
                items,
                state.isLoading,
                getItem,
                addItem,
                updateItem,
                patchItem,
                deleteItem,
                mutate,
            ],
        );

        return <Context.Provider value={contextValue}>{children}</Context.Provider>;
    };

    const useCollection = (hookName: string) => {
        const context = useContext(Context);

        if (context === undefined || context.default) {
            throw new Error(`${hookName} must be used within its provider`);
        }

        return context;
    };

    return { Provider, useCollection };
}
