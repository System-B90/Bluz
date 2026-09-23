import { safeApiFetcher } from "@/api-client/common";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { ShuffleUsages } from "@/api-shared/types/gantt/shuffles";

/** Modules and events currently tagged with any of `names`. */
export async function apiGetShuffleUsages(
    syllabusId: GanttSyllabusId,
    names: Array<string>,
): Promise<ShuffleUsages> {
    if (names.length === 0) return { events: [], modules: [] };

    const url = new URL(
        `/api/gantt/syllabuses/${encodeURIComponent(syllabusId)}/shuffles`,
        window.location.origin,
    );
    for (const name of names) url.searchParams.append("name", name);

    return await safeApiFetcher<ShuffleUsages>(url.toString());
}

/**
 * Replaces the syllabus' shuffle list, stripping every removed name off the
 * modules and events that carry it. Returns what was stripped.
 */
export async function apiApplyShuffles(
    syllabusId: GanttSyllabusId,
    shuffles: Array<string>,
): Promise<ShuffleUsages> {
    return await safeApiFetcher<ShuffleUsages>(
        `/api/gantt/syllabuses/${encodeURIComponent(syllabusId)}/shuffles`,
        { method: "POST", body: JSON.stringify({ shuffles }) },
    );
}
