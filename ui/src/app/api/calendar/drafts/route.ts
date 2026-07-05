export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import {
    DbCalendarDraft,
    DraftAuthor,
} from "@/api-server/db-calendar-draft";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { getSessionUser } from "@/api-server/session-user";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";

type CreateDraftBody = {
    label: string;
    events: Array<DbEventDocument>;
};
type UpdateDraftBody = {
    id: string;
    label?: string;
    events: Array<DbEventDocument>;
};

async function resolveAuthor(): Promise<DraftAuthor> {
    const user = await getSessionUser();
    return { id: user?.id, displayName: user?.displayName ?? "משתמש" };
}

function normalizeEvents(
    events: unknown,
): Array<DbEventDocument> {
    return Array.isArray(events)
        ? (events as Array<DbEventDocument>).map(eventDateFixup)
        : [];
}

/**
 * GET /api/calendar/drafts
 *   - no params  → list shared drafts (summaries, newest-updated first)
 *   - ?id=<uuid> → fetch one draft including its events (to load it)
 */
export const GET = withApi(async (request: Request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const { controller, iterationId } =
        await resolveIterationFromRequest(request);

    if (id) {
        return ApiSuccess(
            await DbCalendarDraft.get(id, controller),
            "no-store",
        );
    }
    return ApiSuccess(
        await DbCalendarDraft.list(controller, iterationId),
        "no-store",
    );
});

/** POST /api/calendar/drafts — create a new shared draft. */
export const POST = withApi(async (request: Request) => {
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const body = (await request.json()) as CreateDraftBody;
    if (!body || typeof body.label !== "string") {
        throw new ClientApiError("A draft label is required.");
    }
    const author = await resolveAuthor();
    return ApiSuccess(
        await DbCalendarDraft.create(
            body.label,
            normalizeEvents(body.events),
            author,
            controller,
            iterationId,
        ),
    );
});

/** PUT /api/calendar/drafts — update an existing shared draft's events/label. */
export const PUT = withApi(async (request: Request) => {
    const { controller } = await resolveWritableIterationFromRequest(
        request,
    );
    const body = (await request.json()) as UpdateDraftBody;
    if (!body || typeof body.id !== "string") {
        throw new ClientApiError("A draft id is required.");
    }
    if (
        body.label !== undefined &&
        typeof body.label !== "string"
    ) {
        throw new ClientApiError("Draft label must be a string.");
    }
    const author = await resolveAuthor();
    return ApiSuccess(
        await DbCalendarDraft.update(
            body.id,
            normalizeEvents(body.events),
            author,
            controller,
            body.label,
        ),
    );
});

/** DELETE /api/calendar/drafts?id=<uuid> — remove a shared draft. */
export const DELETE = withApi(async (request: Request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
        throw new ClientApiError("No draft id provided.");
    }
    const { controller } = await resolveWritableIterationFromRequest(
        request,
    );
    await DbCalendarDraft.del(id, controller);
    return ApiSuccess();
});
