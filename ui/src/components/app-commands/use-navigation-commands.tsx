"use client";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MenuBookIcon from "@mui/icons-material/MenuBook";
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

/** Served by the app itself, so it opens on offline installs too (#760). */
export const API_DOCS_HREF = "/api/docs";

/** Top-level page navigation. Registered app-wide. */
export function useNavigationCommands(): void
{
    const router = useRouter();
    const pathname = usePathname();

    const commands = useMemo(
        () => [
            ...DESTINATIONS.map((destination) => ({
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
            {
                id: "goto.api-docs",
                title: "תיעוד API",
                subtitle: API_DOCS_HREF,
                group: COMMAND_GROUPS.navigation,
                kind: "goto" as const,
                icon: <MenuBookIcon />,
                keywords: [ "api", "docs", "rest", "reference", "תיעוד" ],
                run: () =>
                {
                    window.open(API_DOCS_HREF, "_blank", "noopener");
                },
            },
        ],
        [ router, pathname ],
    );

    useCommands(commands);
}
