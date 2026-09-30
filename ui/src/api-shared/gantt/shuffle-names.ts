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

/** Old shuffle name → new name, applied to the syllabus and every tag (#774). */
export type ShuffleRenames = Record<string, string>;

/**
 * Normalizes a rename map, dropping blank or no-op entries so "renamed to
 * itself" never cascades a write.
 */
export function normalizeShuffleRenames(
    renames: ShuffleRenames | undefined,
): ShuffleRenames {
    const result: ShuffleRenames = {};
    for (const [rawFrom, rawTo] of Object.entries(renames ?? {})) {
        const from = normalizeShuffleName(rawFrom);
        const to = normalizeShuffleName(rawTo);
        if (from && to && from !== to) result[from] = to;
    }
    return result;
}

/**
 * A module/event's tags after a shuffle edit: removed names dropped, renamed
 * ones rewritten. Shared by the server cascade and the client's local mirror.
 */
export function retagShuffles(
    tags: Array<string>,
    removed: Array<string>,
    renames: ShuffleRenames,
): Array<string> {
    return normalizeShuffleNames(
        tags
            .filter((name) => !removed.includes(name))
            .map((name) => renames[name] ?? name),
    );
}

/** Moves each renamed shuffle's entry in a name-keyed record to its new name. */
export function renameShuffleKeys<T>(
    record: Record<string, T>,
    renames: ShuffleRenames,
): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [name, value] of Object.entries(record)) {
        result[renames[name] ?? name] = value;
    }
    return result;
}

/**
 * Shuffle name → the Hive student-group id it is explicitly linked to (#774).
 * A shuffle absent here falls back to the same-named Hive group.
 */
export type ShuffleHiveGroups = Record<string, number>;

/** Keeps only links of `names` whose target is a positive integer id. */
export function normalizeShuffleHiveGroups(
    links: ShuffleHiveGroups | undefined,
    names: Array<string>,
): ShuffleHiveGroups {
    const result: ShuffleHiveGroups = {};
    for (const [rawName, groupId] of Object.entries(links ?? {})) {
        const name = normalizeShuffleName(rawName);
        if (names.includes(name) && Number.isInteger(groupId) && groupId > 0) {
            result[name] = groupId;
        }
    }
    return result;
}

/** True when `links` is a plain string→number record. */
export function isShuffleHiveGroups(
    links: unknown,
): links is ShuffleHiveGroups {
    return (
        typeof links === "object" &&
        links !== null &&
        !Array.isArray(links) &&
        Object.values(links).every((value) => typeof value === "number")
    );
}
