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

/**
 * Hive's `Class.description` limit. A shuffle is 1:1 with a Hive student group,
 * so its description is held to the same cap to stay importable both ways.
 */
export const SHUFFLE_DESCRIPTION_MAX_LENGTH = 100;

/** Shuffle name → staff-facing description (Hive's student-group description). */
export type ShuffleDescriptions = Record<string, string>;

/**
 * Keeps only the descriptions of `names`, trimmed and capped at Hive's limit.
 * Blank descriptions are dropped so "no description" has one representation.
 */
export function normalizeShuffleDescriptions(
    descriptions: ShuffleDescriptions | undefined,
    names: Array<string>,
): ShuffleDescriptions {
    const result: ShuffleDescriptions = {};
    for (const [rawName, rawDescription] of Object.entries(
        descriptions ?? {},
    )) {
        const name = normalizeShuffleName(rawName);
        const description = rawDescription
            .trim()
            .slice(0, SHUFFLE_DESCRIPTION_MAX_LENGTH);
        if (description && names.includes(name)) result[name] = description;
    }
    return result;
}

/** True when `descriptions` is a plain string→string record. */
export function isShuffleDescriptions(
    descriptions: unknown,
): descriptions is ShuffleDescriptions {
    return (
        typeof descriptions === "object" &&
        descriptions !== null &&
        !Array.isArray(descriptions) &&
        Object.values(descriptions).every((value) => typeof value === "string")
    );
}
