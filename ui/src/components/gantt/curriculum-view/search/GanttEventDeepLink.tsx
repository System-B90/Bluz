"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useGanttSearchNav } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { useGanttSearchItems } from "@/components/gantt/curriculum-view/search/use-gantt-search-items";

/** Query param carrying the gantt event id to jump to, e.g. from the schedule
 * event dialog's "cut from" link (#576). */
export const GANTT_EVENT_DEEP_LINK_PARAM = "ge";

/**
 * Watches for `?ge=<ganttEventId>` and, once that event shows up in the
 * loaded curriculum's search items, scrolls to and highlights its owning
 * syllabus — the same navigation the command palette's gantt entities use.
 * Renders nothing; mount inside `GanttSearchNavProvider`.
 */
export function GanttEventDeepLink() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const items = useGanttSearchItems();
    const { goToSyllabus } = useGanttSearchNav();

    const targetEventId = searchParams.get(GANTT_EVENT_DEEP_LINK_PARAM);

    useEffect(() => {
        if (!targetEventId) {
            return;
        }

        const match = items.find(
            (item) => item.type === "event" && item.eventId === targetEventId,
        );
        if (!match) {
            return;
        }

        goToSyllabus(match.syllabusId);

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete(GANTT_EVENT_DEEP_LINK_PARAM);
        const nextSearch = nextParams.toString();
        router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }, [targetEventId, items, goToSyllabus, router, pathname, searchParams]);

    return null;
}
