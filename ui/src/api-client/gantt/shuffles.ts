import { safeApiFetcher } from "@/api-client/common";
import { ShuffleDescriptions } from "@/api-shared/gantt/shuffle-names";
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
 * modules and events that carry it. Returns what was stripped. Omitting
 * `descriptions` keeps the surviving names' current descriptions.
 */
export async function apiApplyShuffles(
    syllabusId: GanttSyllabusId,
    shuffles: Array<string>,
    descriptions?: ShuffleDescriptions,
): Promise<ShuffleUsages> {
    return await safeApiFetcher<ShuffleUsages>(
        `/api/gantt/syllabuses/${encodeURIComponent(syllabusId)}/shuffles`,
        { method: "POST", body: JSON.stringify({ descriptions, shuffles }) },
    );
}
