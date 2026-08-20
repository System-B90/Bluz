/**
 * Name: hive-links.ts
 * Purpose: Builds deep links into the Hive UI for the entities Bluz drives.
 * Created: 2026-08-13
 * Author: Michael K. Steinberg
 */

/**
 * Base Hive URL for links rendered in the browser. `NEXT_PUBLIC_HIVE_URL` is
 * the same instance the server talks to, and is safe to expose (it is the URL
 * users log in through).
 */
function hiveBaseUrl(override?: string): string {
    return (override ?? process.env.NEXT_PUBLIC_HIVE_URL ?? "").replace(
        /\/$/,
        "",
    );
}

/**
 * Link to a module's Hive page — the one screen that lists both its lessons
 * (with their group→queue rules) and its queues. Hive has no per-lesson
 * route, so this is as deep as a lesson link goes.
 *
 * @param subjectId Hive subject id.
 * @param moduleId Hive module id.
 * @param baseUrl Hive instance; defaults to `NEXT_PUBLIC_HIVE_URL`.
 * @returns The absolute URL, or null when ids or the Hive URL are missing.
 * @example
 * ```typescript
 * hiveModuleUrl(4, 17); // "https://hive.example/course/4/17"
 * ```
 */
export function hiveModuleUrl(
    subjectId: null | number | undefined,
    moduleId: null | number | undefined,
    baseUrl?: string,
): null | string {
    const base = hiveBaseUrl(baseUrl);
    if (!base || !subjectId || !moduleId) return null;
    return `${base}/course/${subjectId}/${moduleId}`;
}

/**
 * Link to a subject's Hive page.
 *
 * @param subjectId Hive subject id.
 * @param baseUrl Hive instance; defaults to `NEXT_PUBLIC_HIVE_URL`.
 * @returns The absolute URL, or null when the id or Hive URL is missing.
 */
export function hiveSubjectUrl(
    subjectId: null | number | undefined,
    baseUrl?: string,
): null | string {
    const base = hiveBaseUrl(baseUrl);
    if (!base || !subjectId) return null;
    return `${base}/course/${subjectId}`;
}

/**
 * Link to a student group in Hive's mentor view — where its current lesson
 * and queue are shown and can be reassigned by hand.
 *
 * @param hiveClassId Hive class (student group) id.
 * @param baseUrl Hive instance; defaults to `NEXT_PUBLIC_HIVE_URL`.
 * @returns The absolute URL, or null when the id or Hive URL is missing.
 */
export function hiveClassUrl(
    hiveClassId: null | number | undefined,
    baseUrl?: string,
): null | string {
    const base = hiveBaseUrl(baseUrl);
    if (!base || !hiveClassId) return null;
    return `${base}/mentor/classes?id=${hiveClassId}`;
}
