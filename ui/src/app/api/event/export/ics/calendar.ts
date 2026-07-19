import { DbEventDocument, eventTypeToHebrew } from "@/api-shared/types/event";

// Escapes text per RFC 5545 §3.3.11 (COMMA, SEMICOLON, BACKSLASH, newline).
function escapeIcsText(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
        .replace(/\n/g, "\\n");
}

// Folds lines longer than 75 octets per RFC 5545 §3.1.
function foldLine(line: string): string {
    if (line.length <= 75) return line;
    const chunks: Array<string> = [];
    let rest = line;
    while (rest.length > 75) {
        chunks.push(rest.slice(0, 75));
        rest = ` ${rest.slice(75)}`;
    }
    chunks.push(rest);
    return chunks.join("\r\n");
}

function icsDateTime(date: Date): string {
    return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
}

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
            lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\\n"))}`);
        }
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return lines.map(foldLine).join("\r\n") + "\r\n";
}
