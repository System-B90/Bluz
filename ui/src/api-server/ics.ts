/*
 * RFC 5545 building blocks shared by every ICS Bluz emits (the staff
 * download and the Hive schedule feed). Server-only: folding counts UTF-8
 * octets through `Buffer`.
 */

// Escapes text per RFC 5545 §3.3.11 (COMMA, SEMICOLON, BACKSLASH, newline).
// Callers pass real newlines; the `\n` escape sequence is produced here, after
// backslash escaping, so it survives to the wire intact.
export function escapeIcsText(text: null | string | undefined): string {
    return (
        (text ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/,/g, "\\,")
            .replace(/;/g, "\\;")
            // Normalize CRLF/CR first, or a Windows-authored note leaves a bare CR
            // in the middle of a content line.
            .replace(/\r\n?/g, "\n")
            .replace(/\n/g, "\\n")
    );
}

const MAX_LINE_OCTETS = 75;

// Folds lines longer than 75 octets per RFC 5545 §3.1. The limit is octets, not
// characters: Hebrew is 2 bytes per character in UTF-8, so counting characters
// folded Hebrew lines at ~150 octets and strict parsers could reject them.
export function foldLine(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= MAX_LINE_OCTETS) return line;

    const chunks: Array<string> = [];
    let offset = 0;
    // Continuation lines start with a space, which itself costs one octet.
    let budget = MAX_LINE_OCTETS;
    while (offset < bytes.length) {
        let take = Math.min(budget, bytes.length - offset);
        // Never split a multi-byte UTF-8 sequence: back off to the last lead
        // byte if the cut would land inside one (continuation bytes are 10xxxxxx).
        while (take > 0 && (bytes[offset + take] & 0xc0) === 0x80) take -= 1;
        if (take === 0) break; // Defensive: a single character wider than the budget.

        const chunk = bytes.subarray(offset, offset + take).toString("utf8");
        chunks.push(chunks.length === 0 ? chunk : ` ${chunk}`);
        offset += take;
        budget = MAX_LINE_OCTETS - 1;
    }
    return chunks.join("\r\n");
}

export function icsDateTime(date: Date): string {
    return new Date(date)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
}

/** Joins content lines into a wire-ready calendar: folded, CRLF-terminated. */
export function serializeIcsLines(lines: Array<string>): string {
    return lines.map(foldLine).join("\r\n") + "\r\n";
}
