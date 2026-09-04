"use client";
import EventIcon from "@mui/icons-material/Event";
import { Command, useCommands } from "@system-b90/command-palette";
import dayjs from "dayjs";
import { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { Event } from "@/components/schedule/types/event";

export type ScheduleEventCommandActions = {
    events: Array<Event>;
    onSelect: (event: Event) => void;
};

/**
 * Entity lane over the events currently loaded on the schedule page — the
 * palette equivalent of scrolling the calendar to find one. Scoped to
 * whatever range the calendar has fetched (`startDate`/`endDate`), so it
 * only ever lists what's actually on screen.
 *
 * Contributed by the schedule page only — the calendar owns the loaded event
 * list, and there is no equivalent surface on the gantt page.
 */
export function useScheduleEventCommands({
    events,
    onSelect,
}: ScheduleEventCommandActions): void {
    const commands = useMemo<Array<Command>>(
        () =>
            events.map((event) => ({
                id: `schedule.event.${event.id}`,
                title: event.name,
                subtitle: dayjs(event.startTime).format("DD/MM HH:mm"),
                group: COMMAND_GROUPS.schedule,
                kind: "entity" as const,
                icon: <EventIcon />,
                keywords: ["event", "אירוע", "מופע"],
                run: () => onSelect(event),
            })),
        [events, onSelect],
    );

    useCommands(commands);
}
