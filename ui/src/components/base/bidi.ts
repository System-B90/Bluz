/**
 * Bidi helpers for rendering ranges inside the RTL Hebrew UI.
 *
 * In an RTL paragraph, digit runs resolve to `EN` and UAX #9 rule N1 resolves
 * the neutral characters *between* two `EN` runs to `R`. So a separator like
 * `" - "` becomes an RTL separator and the two numeric sides are laid out
 * right-to-left: `10:00 - 12:00` renders as `12:00 - 10:00`. The string is
 * correct in memory and wrong on screen.
 *
 * Wrapping the whole range in an isolate (LRI … PDI) pins it to one LTR run
 * without affecting the surrounding paragraph direction.
 */

/** U+2066 LEFT-TO-RIGHT ISOLATE */
const LRI = "⁦";
/** U+2069 POP DIRECTIONAL ISOLATE */
const PDI = "⁩";

/**
 * Wraps `text` so it always lays out left-to-right, whatever paragraph it sits
 * in. Use for any two-sided range whose sides are numeric.
 */
export function isolateLtr(text: string): string {
    return `${LRI}${text}${PDI}`;
}

/**
 * Formats `start - end` as a single LTR run. Both sides are already-formatted
 * strings, so this works for times (`10:00`), day numbers (`05`), or anything
 * else that reads left-to-right.
 */
export function formatRange(start: string, end: string): string {
    return isolateLtr(`${start} - ${end}`);
}
