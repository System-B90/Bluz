"use client";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import SchoolIcon from "@mui/icons-material/School";
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";
import { Command, useCommands } from "@system-b90/command-palette";
import { ReactNode, useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { GANTT_TAB_INDEX } from "@/components/app-onboarding/gantt/tabs";

type TabKey = keyof typeof GANTT_TAB_INDEX;

/**
 * What the timeline toolbar's own view commands answer to. Those commands are
 * registered only while the timeline is mounted, so on the other tabs a search
 * for e.g. "משובצים" found nothing (#846). The timeline tab command answers to
 * the same words and takes the user there.
 */
export const TIMELINE_VIEW_KEYWORDS = [
    "unallocated", "unscheduled", "לא משובצים", "משובצים", "פערים",
    "constraints", "אילוצים",
    "breaks", "הפסקות",
    "weekly", "daily", "שבועי", "יומי",
];

/** Mirrors the tab strip in `CurriculumViewTabs` — same labels, same order. */
const TABS: Array<{ tab: TabKey; title: string; icon: ReactNode; keywords: Array<string> }> = [
    {
        tab: "syllabuses",
        title: "סילבוסים",
        icon: <SchoolIcon />,
        keywords: [ "syllabuses", "syllabus", "סילבוס" ],
    },
    {
        tab: "weeks",
        title: "שבועות",
        icon: <CalendarViewWeekIcon />,
        keywords: [ "weeks", "capacity", "שבוע" ],
    },
    {
        tab: "timeline",
        title: "רצף זמן",
        icon: <ViewTimelineIcon />,
        keywords: [ "timeline", "gantt view", "ציר זמן", ...TIMELINE_VIEW_KEYWORDS ],
    },
    {
        tab: "grid",
        title: "טבלה",
        icon: <TableChartIcon />,
        keywords: [ "grid", "table", "excel", "אקסל" ],
    },
];

export type GanttTabCommandActions = {
    selectedTabIndex: number;
    setSelectedTabIndex: (index: number) => void;
};

/**
 * One command per gantt view tab. Contributed by `CurriculumView`, which owns
 * the selected tab.
 */
export function useGanttTabCommands({
    selectedTabIndex,
    setSelectedTabIndex,
}: GanttTabCommandActions): void
{
    const commands = useMemo<Array<Command>>(
        () =>
            TABS.map(({ tab, title, icon, keywords }) => ({
                id: `gantt.tab.${tab}`,
                title: `תצוגת ${title}`,
                group: COMMAND_GROUPS.gantt,
                kind: "command" as const,
                icon,
                keywords: [ "tab", "view", "גאנט", ...keywords ],
                enabled: selectedTabIndex !== GANTT_TAB_INDEX[tab],
                run: () => setSelectedTabIndex(GANTT_TAB_INDEX[tab]),
            })),
        [ selectedTabIndex, setSelectedTabIndex ],
    );

    useCommands(commands);
}
