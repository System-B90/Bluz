"use client";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";
import { useCommands } from "@system-b90/command-palette";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";

type Destination = {
    id: string;
    title: string;
    href: string;
    icon: ReactNode;
    keywords: Array<string>;
};

const DESTINATIONS: Array<Destination> = [
    {
        id: "goto.schedule",
        title: "לוח זמנים",
        href: "/",
        icon: <CalendarMonthIcon />,
        keywords: [ "schedule", "calendar", "לוח", "יומן" ],
    },
    {
        id: "goto.gantt",
        title: "גאנט",
        href: "/gantt",
        icon: <ViewTimelineIcon />,
        keywords: [ "gantt", "curriculum", "תכנית", "מערכת" ],
    },
];

/** Top-level page navigation. Registered app-wide. */
export function useNavigationCommands(): void
{
    const router = useRouter();
    const pathname = usePathname();

    const commands = useMemo(
        () =>
            DESTINATIONS.map((destination) => ({
                id: destination.id,
                title: `מעבר אל ${destination.title}`,
                subtitle: destination.href,
                group: COMMAND_GROUPS.navigation,
                kind: "goto" as const,
                icon: destination.icon,
                keywords: destination.keywords,
                // Already here — show it, but don't pretend it does anything.
                enabled: pathname !== destination.href,
                run: () => router.push(destination.href),
            })),
        [ router, pathname ],
    );

    useCommands(commands);
}
