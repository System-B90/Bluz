/**
 * The canonical form of a shuffle name: trimmed, with inner runs of whitespace
 * collapsed. Tags are matched by exact string, so "א  ב" and "א ב" would
 * otherwise be two shuffles that look identical in every chip and dropdown.
 */
export function normalizeShuffleName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
}

/**
 * Normalizes a whole shuffle list, dropping blanks and repeats while keeping
 * the first-seen order the user arranged them in.
 */
export function normalizeShuffleNames(names: Array<string>): Array<string> {
    const seen = new Set<string>();
    const result: Array<string> = [];
    for (const raw of names) {
        const name = normalizeShuffleName(raw);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        result.push(name);
    }
    return result;
}

/** True when `names` is an array of strings — the only shape a list may take. */
export function isShuffleNameList(names: unknown): names is Array<string> {
    return (
        Array.isArray(names) && names.every((name) => typeof name === "string")
    );
}
