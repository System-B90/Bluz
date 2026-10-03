import { usePathname, useSearchParams } from "next/navigation";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { GANTT_TAB_COUNT } from "@/components/app-onboarding/gantt/tabs";

export const GANTT_TAB_PARAM = "v";

/** The tab index a `v=` value names, or 0 when missing, garbage or out of range. */
export function parseGanttTabIndex(raw: null | string): number
{
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    // Old links can carry the index of a since-removed tab.
    return Number.isFinite(parsed) && parsed >= 0 && parsed < GANTT_TAB_COUNT
        ? parsed
        : 0;
}

/**
 * The selected gantt tab, kept in step with `v=` both ways (#844).
 *
 * Selecting a tab writes `v=`. Anything else that rewrites the URL — e.g. the
 * settings dialog's `router.replace`, built from search params read before a
 * tab switch — moves the tab to match, so the shown tab is always the one a
 * reload or a shared link would open.
 */
export function useGanttTabUrl(): [number, Dispatch<SetStateAction<number>>]
{
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlTab = searchParams.get(GANTT_TAB_PARAM);

    const [ selectedTabIndex, setSelectedTabIndex ] = useState(() => parseGanttTabIndex(urlTab));

    // Follow external URL changes. Only a *change* of `v` counts, so the
    // missing `v` of a fresh landing URL doesn't fight the initial state.
    const [ seenUrlTab, setSeenUrlTab ] = useState(urlTab);
    if (urlTab !== seenUrlTab)
    {
        setSeenUrlTab(urlTab);
        if (urlTab !== null) setSelectedTabIndex(parseGanttTabIndex(urlTab));
    }

    useEffect(() =>
    {
        const current = selectedTabIndex.toString();
        const nextParams = new URLSearchParams(window.location.search);
        if (nextParams.get(GANTT_TAB_PARAM) === current) return;

        nextParams.set(GANTT_TAB_PARAM, current);
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", nextUrl);
    }, [ selectedTabIndex, pathname ]);

    return [ selectedTabIndex, setSelectedTabIndex ];
}
