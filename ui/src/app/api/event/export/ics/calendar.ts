import {
    escapeIcsText,
    icsDateTime,
    serializeIcsLines,
} from "@/api-server/ics";
import { DbEventDocument, eventTypeToHebrew } from "@/api-shared/types/event";

export function buildScheduleIcsCalendar(
    events: Array<DbEventDocument>,
    calendarName: string,
): string {
    const lines: Array<string> = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bluz//Schedule Export//HE",
        "CALSCALE:GREGORIAN",
        `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ];

    const stamp = icsDateTime(new Date());

    for (const event of events) {
        const descriptionParts = [
            eventTypeToHebrew(event.type),
            event.notes?.trim(),
        ].filter(Boolean) as Array<string>;

        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id}@bluz-schedule`,
            `DTSTAMP:${stamp}`,
            `DTSTART:${icsDateTime(event.startTime)}`,
            `DTEND:${icsDateTime(event.endTime)}`,
            `SUMMARY:${escapeIcsText(event.name)}`,
        );
        if (descriptionParts.length > 0) {
            lines.push(
                `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
            );
        }
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return serializeIcsLines(lines);
}
