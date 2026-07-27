import { isWordStart, normalizeChars, normalizeText } from "./text";

/**
 * The matcher. Hand-rolled rather than pulled from a library so the package
 * carries zero runtime dependencies beyond React/MUI, and so scoring can be
 * tuned for the palette's specific shape (short titles, Hebrew content, a need
 * for per-character match indices to drive highlighting).
 */

export type MatchResult = {
    /** `0` when the query is not a subsequence of the target. Higher is better. */
    score: number;
    /** Indices into the *original* target string that matched. */
    indices: Array<number>;
};

const NO_MATCH: MatchResult = { score: 0, indices: [] };

/** Awarded once when the whole query appears contiguously in the target. */
const CONTIGUOUS_BONUS = 120;
/** Awarded once when that contiguous run also starts a word. */
const PREFIX_BONUS = 90;
/** Per character that continues the previous character's run. */
const RUN_BONUS = 14;
/** Per character that lands on a word boundary. */
const WORD_START_BONUS = 10;
/** Baseline per matched character. */
const CHAR_SCORE = 3;
/** Subtracted per character of distance from the start of the target. */
const DISTANCE_PENALTY = 0.4;

type Folded = {
    /** Normalised text with dropped characters removed. */
    text: string;
    /** `sourceIndex[i]` is the index in the original string of `text[i]`. */
    sourceIndex: Array<number>;
};

function fold(text: string): Folded {
    const chars = normalizeChars(text);
    let folded = "";
    const sourceIndex: Array<number> = [];

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (!char) continue;
        folded += char;
        sourceIndex.push(i);
    }

    return { text: folded, sourceIndex };
}

/**
 * Score `query` against `target`.
 *
 * An empty query matches everything with a score of `1`, which lets callers use
 * the same code path for the "nothing typed yet" listing.
 */
export function matchText(query: string, target: string): MatchResult {
    const needle = normalizeText(query);
    if (!needle) return { score: 1, indices: [] };
    if (!target) return NO_MATCH;

    const { text: haystack, sourceIndex } = fold(target);
    if (!haystack) return NO_MATCH;

    const direct = haystack.indexOf(needle);
    if (direct !== -1) {
        const indices: Array<number> = [];
        for (let i = 0; i < needle.length; i++) {
            indices.push(sourceIndex[direct + i]);
        }

        const score =
            CONTIGUOUS_BONUS +
            (isWordStart(haystack, direct) ? PREFIX_BONUS : 0) +
            needle.length * (CHAR_SCORE + RUN_BONUS) -
            direct * DISTANCE_PENALTY;

        return { score: Math.max(score, 1), indices };
    }

    return subsequenceMatch(needle, haystack, sourceIndex);
}

/**
 * In-order subsequence fallback. Greedy from the left, which is the standard
 * trade-off here: an optimal alignment would need a DP pass, and for the short
 * strings the palette deals with the greedy pick is indistinguishable in
 * practice while staying O(n).
 */
function subsequenceMatch(
    needle: string,
    haystack: string,
    sourceIndex: Array<number>,
): MatchResult {
    const indices: Array<number> = [];
    let score = 0;
    let needleIndex = 0;
    let previousMatch = -2;

    for (let i = 0; i < haystack.length && needleIndex < needle.length; i++) {
        if (haystack[i] !== needle[needleIndex]) continue;

        score += CHAR_SCORE;
        if (previousMatch === i - 1) score += RUN_BONUS;
        if (isWordStart(haystack, i)) score += WORD_START_BONUS;
        if (needleIndex === 0) score -= i * DISTANCE_PENALTY;

        indices.push(sourceIndex[i]);
        previousMatch = i;
        needleIndex++;
    }

    // Every query character must be consumed for the match to count.
    if (needleIndex < needle.length) return NO_MATCH;

    return { score: Math.max(score, 1), indices };
}
