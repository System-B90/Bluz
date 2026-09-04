"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useGanttSearchItems } from "@/components/gantt/curriculum-view/search/use-gantt-search-items";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

/** Query param carrying the gantt event id to jump to, e.g. from the schedule
 * event dialog's "cut from" link (#576). */
export const GANTT_EVENT_DEEP_LINK_PARAM = "ge";

/**
 * Watches for `?ge=<ganttEventId>` and, once that event shows up in the
 * loaded curriculum's search items, opens its module dialog and then the
 * event dialog on top — the same pair of calls a user clicking the event
 * from inside the module dialog would trigger. Renders nothing; mount
 * inside `CurriculumProvider`.
 */
export function GanttEventDeepLink() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const items = useGanttSearchItems();
    const { openModuleDialog, openEventDialog } = useCurriculumProviderActions();

    const targetEventId = searchParams.get(GANTT_EVENT_DEEP_LINK_PARAM);

    useEffect(() => {
        if (!targetEventId) {
            return;
        }

        const match = items.find(
            (item) => item.type === "event" && item.eventId === targetEventId,
        );
        if (!match || !match.moduleId || !match.eventId) {
            return;
        }

        openModuleDialog(match.syllabusId, match.moduleId, match.eventId);
        openEventDialog(match.syllabusId, match.moduleId, match.eventId);

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete(GANTT_EVENT_DEEP_LINK_PARAM);
        const nextSearch = nextParams.toString();
        router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }, [
        targetEventId,
        items,
        openModuleDialog,
        openEventDialog,
        router,
        pathname,
        searchParams,
    ]);

    return null;
}
