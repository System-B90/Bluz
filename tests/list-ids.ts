/**
 * Id extraction for the per-test isolation sweep.
 *
 * The list endpoints do not agree on a shape: most answer `{ data: [{ id }] }`,
 * but the gantt collection routes answer `{ data: { <id>: <title> } }` — a
 * keyed map (see `ui/src/app/api/gantt/base-collection.ts`). The sweep assumed
 * an array everywhere, so `GET /api/gantt/curriculums` threw
 * "flatMap is not a function" and aborted the whole cleanup block partway
 * through, skipping the curriculum, event and settings-entity sweeps that
 * follow it. The failure was caught and logged as a warning, so runs stayed
 * green while leaking exactly what the sweep exists to collect.
 *
 * Kept free of Playwright imports so it can be unit tested directly.
 */
export function idsFromListBody(body: unknown): Array<string> {
    const data = (body as { data?: unknown } | null | undefined)?.data;
    if (!data) return [];

    if (Array.isArray(data)) {
        return data.flatMap((row) => {
            const id = (row as { id?: unknown } | null)?.id;
            return typeof id === "string" ? [id] : [];
        });
    }

    if (typeof data === "object") {
        return Object.keys(data as Record<string, unknown>);
    }

    return [];
}
