// Quote-like characters that should be ignored when matching, so that
// e.g. typing `עע` matches `ע"ע` / `ע״ע`, and `"foo"` matches `foo`.
const QUOTE_CHARS = /['"`׳״“”‘’]/g;

/**
 * Normalize text for fuzzy matching: lowercase, strip quotation marks and
 * collapse whitespace. Quote stripping is what lets the search shrug off the
 * Hebrew gershayim/geresh that pepper module and event names.
 */
export function normalizeSearchText(text: string): string {
    return text
        .toLowerCase()
        .replace(QUOTE_CHARS, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Score how well `query` matches `target`.
 *
 * - `0` means no match (not every query character is present, in order).
 * - Higher is better: exact substrings beat scattered subsequences, earlier
 *   matches beat later ones, and consecutive runs are rewarded.
 */
export function fuzzyScore(query: string, target: string): number {
    const q = normalizeSearchText(query);
    const t = normalizeSearchText(target);

    if (!q) return 1;
    if (!t) return 0;

    const directIndex = t.indexOf(q);
    if (directIndex !== -1) {
        // Contiguous match — strongly preferred, favouring earlier positions.
        return 1000 - directIndex;
    }

    // Fall back to an in-order subsequence match with a consecutive-run bonus.
    let queryIndex = 0;
    let score = 0;
    let previousMatchIndex = -1;

    for (let i = 0; i < t.length && queryIndex < q.length; i++) {
        if (t[i] === q[queryIndex]) {
            score += previousMatchIndex === i - 1 ? 5 : 1;
            previousMatchIndex = i;
            queryIndex++;
        }
    }

    // Every query character must be consumed for a valid match.
    return queryIndex === q.length ? score : 0;
}
