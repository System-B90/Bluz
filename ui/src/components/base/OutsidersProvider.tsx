"use client";
import { useCallback, useMemo } from "react";

import {
    apiCreateOutsider,
    apiDeleteOutsider,
    apiGetOutsiders,
    apiUpdateOutsider,
} from "@/api-client/outsiders";
import { Outsider } from "@/api-shared/types/outsider";
import { createCollectionProvider } from "@/components/base/collection/create-collection-provider";
import { MessageTypes } from "@/settings";

export type OutsidersContextState = {
    default: boolean;
    outsiders: Array<Outsider>;
    isLoading: boolean;
    getOutsider: (id: string) => null | Outsider;
    addOutsider: (outsiderData: Omit<Outsider, "id">) => Promise<void>;
    updateOutsider: (outsider: Outsider) => Promise<void>;
    deleteOutsider: (outsiderId: string) => Promise<void>;
};

const { Provider, useCollection } = createCollectionProvider<
    Outsider,
    string,
    Omit<Outsider, "id">
>({
    api: {
        list: apiGetOutsiders,
        create: apiCreateOutsider,
        update: apiUpdateOutsider,
        remove: apiDeleteOutsider,
    },
    getKey: (outsider) => outsider.id,
    getId: (outsider) => outsider.id,
    getLabel: (outsider) => outsider.name,
    buildItem: (data) => ({ id: `outsider-${crypto.randomUUID()}`, ...data }),
    messages: {
        loadFailed: "טעינת אנשי חוץ נכשלה.",
        createSuccess: (name) => `יצירת איש חוץ ${name} הסתיימה בהצלחה.`,
        createFailure: (name) => `יצירת איש חוץ ${name} נכשלה!`,
        updateSuccess: (name) => `עדכון איש חוץ ${name} הסתיים בהצלחה.`,
        updateFailure: (name) => `עדכון איש חוץ ${name} נכשל!`,
        deleteSuccess: (name) => `מחיקת איש חוץ ${name} הסתיימה בהצלחה.`,
        deleteFailure: (name) => `מחיקת איש חוץ ${name} נכשלה!`,
    },
    // The server broadcasts no incremental map for outsiders, so every update
    // message triggers a full reload.
    websocket: { messageType: MessageTypes.OUTSIDERS_UPDATE },
});

export const OutsidersProvider = Provider;

export const useOutsiders = (): OutsidersContextState => {
    const collection = useCollection("useOutsiders");
    const { getItem } = collection;

    const getOutsider = useCallback(
        (id: string) => getItem(id) ?? null,
        [getItem],
    );

    return useMemo(
        () => ({
            default: false,
            outsiders: collection.items,
            isLoading: collection.isLoading,
            getOutsider,
            addOutsider: collection.addItem,
            updateOutsider: collection.updateItem,
            deleteOutsider: collection.deleteItem,
        }),
        [collection, getOutsider],
    );
};
