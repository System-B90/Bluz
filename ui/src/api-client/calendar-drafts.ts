import { safeApiFetcher } from "@/api-client/common";
import { withIteration } from "@/api-client/iteration-query";
import { eventDateFixup } from "@/api-shared/calendar";
import { CalendarDraft, CalendarDraftSummary } from "@/api-shared/types";
import { DbEventDocument, Event } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

const DRAFTS_PATH = "/api/calendar/drafts";

/** Lists all shared drafts (newest-updated first), without their events payload. */
export async function apiListDrafts(
    iterationId?: IterationId,
): Promise<Array<CalendarDraftSummary>> {
    const endpoint = withIteration(
        new URL(DRAFTS_PATH, window.location.origin),
        iterationId,
    );
    return await safeApiFetcher<Array<CalendarDraftSummary>>(
        endpoint.toString(),
        { method: "GET" },
    );
}

/** Creates a new shared draft capturing the supplied events. */
export async function apiCreateDraft(
    label: string,
    events: Array<Event>,
    iterationId?: IterationId,
): Promise<CalendarDraftSummary> {
    const endpoint = withIteration(
        new URL(DRAFTS_PATH, window.location.origin),
        iterationId,
    );
    return await safeApiFetcher<CalendarDraftSummary>(endpoint.toString(), {
        method: "POST",
        body: JSON.stringify({ label, events }),
    });
}

/** Updates an existing shared draft's events (and optionally its label). */
export async function apiUpdateDraft(
    id: string,
    events: Array<Event>,
    iterationId?: IterationId,
    label?: string,
): Promise<CalendarDraftSummary> {
    const endpoint = withIteration(
        new URL(DRAFTS_PATH, window.location.origin),
        iterationId,
    );
    return await safeApiFetcher<CalendarDraftSummary>(endpoint.toString(), {
        method: "PUT",
        body: JSON.stringify({ id, label, events }),
    });
}

/** Fetches one draft including its events, mapped into the client Event shape. */
export async function apiGetDraft(
    draftId: string,
    iterationId?: IterationId,
): Promise<{ draft: CalendarDraft; events: Array<Event> }> {
    const endpoint = withIteration(
        new URL(DRAFTS_PATH, window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", draftId);
    const draft = await safeApiFetcher<CalendarDraft>(endpoint.toString(), {
        method: "GET",
    });
    const events = (draft.events ?? []).map(
        (e: DbEventDocument) => eventDateFixup(e) as unknown as Event,
    );
    return { draft, events };
}

/** Permanently deletes a shared draft. */
export async function apiDeleteDraft(
    draftId: string,
    iterationId?: IterationId,
): Promise<void> {
    const endpoint = withIteration(
        new URL(DRAFTS_PATH, window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", draftId);
    await safeApiFetcher<void>(endpoint.toString(), { method: "DELETE" });
}
