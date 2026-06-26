import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export const SETTINGS_TABS = [
    "personal",
    "global",
    "rooms",
    "outsiders",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const SETTINGS_PARAM = "settings";
const DEFAULT_TAB: SettingsTab = "personal";
const EDIT_PARAMS = ["editRoom", "editOutsider"] as const;

function toValidTab(value: null | string): null | SettingsTab {
    return SETTINGS_TABS.includes(value as SettingsTab)
        ? (value as SettingsTab)
        : null;
}

export function useSettingsDialogUrl() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const rawParam = searchParams.get(SETTINGS_PARAM);
    // Backwards compat: editRoom without settings param → rooms tab
    const hasLegacyEditRoom = !rawParam && !!searchParams.get("editRoom");

    const isOpen = rawParam !== null || hasLegacyEditRoom;

    const activeTab = useMemo<SettingsTab>(
        () =>
            toValidTab(rawParam) ??
            (hasLegacyEditRoom ? "rooms" : DEFAULT_TAB),
        [rawParam, hasLegacyEditRoom],
    );

    const openDialog = useCallback(
        (tab: SettingsTab = DEFAULT_TAB) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(SETTINGS_PARAM, tab);
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    const closeDialog = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete(SETTINGS_PARAM);
        EDIT_PARAMS.forEach((p) => params.delete(p));
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [router, searchParams]);

    const setTab = useCallback(
        (tab: SettingsTab) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(SETTINGS_PARAM, tab);
            // Clear other tabs' edit params when switching
            EDIT_PARAMS.forEach((p) => params.delete(p));
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    return { isOpen, activeTab, openDialog, closeDialog, setTab };
}
