/**
 * Text normalisation shared by the matcher.
 *
 * Deliberately Hebrew-aware: the palette is used against Hebrew content where
 * niqqud, gershayim and final-form letters would otherwise cause a typed query
 * to miss an obviously-matching target.
 */

/**
 * Characters dropped entirely before matching:
 * - U+0591–U+05C7 — Hebrew points and cantillation marks
 * - quote-likes, including the geresh/gershayim that pepper Hebrew names
 * - bidi controls, which ride along in copy-pasted RTL text
 *
 * Non-global on purpose: these are tested one character at a time, and a `g`
 * flag would make `test()` stateful via `lastIndex`.
 */
const DROPPED_CHARS = /[֑-ׇ'"`׳״‘’“”‎‏‪-‮⁦-⁩]/;

/** Final-form letter → base form, so `ירושלים` is reachable by typing `מ`. */
const FINAL_FORMS: Record<string, string> = {
    "ך": "כ", // ך → כ
    "ם": "מ", // ם → מ
    "ן": "נ", // ן → נ
    "ף": "פ", // ף → פ
    "ץ": "צ", // ץ → צ
};

/**
 * Fold text into its match form: lowercase, no marks, no quotes, no bidi
 * controls, final letters unified, whitespace collapsed.
 *
 * Length is *not* preserved, so this must not be used when match indices need
 * to map back onto the original string — use {@link normalizeChars} for that.
 */
export function normalizeText(text: string): string {
    return normalizeChars(text).join("").replace(/\s+/g, " ").trim();
}

/**
 * Per-character fold. Returns one entry per input character (the empty string
 * for dropped characters), which keeps indices aligned with the source string
 * so the UI can highlight the exact characters that matched.
 */
export function normalizeChars(text: string): Array<string> {
    return Array.from(text, (char) => {
        if (DROPPED_CHARS.test(char)) return "";
        return FINAL_FORMS[char] ?? char.toLowerCase();
    });
}

/** True when the character at `index` starts a word in `normalized`. */
export function isWordStart(normalized: string, index: number): boolean {
    if (index === 0) return true;
    const previous = normalized[index - 1];
    return previous === " " || previous === "-" || previous === "/";
}
