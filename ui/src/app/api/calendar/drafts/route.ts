export const dynamic = "force-dynamic";

import {
    normalizeOptionalStoredEvents,
    normalizeStoredEvents,
    requireIdParam,
} from "@/api-server/calendar-store-request";
import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { DbCalendarDraft, DraftAuthor } from "@/api-server/db-calendar-draft";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { getSessionUser, requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";

type CreateDraftBody = {
    label: string;
    events?: Array<DbEventDocument>;
};
type UpdateDraftBody = {
    id: string;
    label?: string;
    events?: Array<DbEventDocument>;
};

async function resolveAuthor(): Promise<DraftAuthor> {
    const user = await getSessionUser();
    return { id: user?.id, displayName: user?.displayName ?? "משתמש" };
}

/**
 * GET /api/calendar/drafts
 *   - no params  → list shared drafts (summaries, newest-updated first)
 *   - ?id=<uuid> → fetch one draft including its events (to load it)
 */
export const GET = withApi(async (request: Request) => {
    await requireStaffSession();
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
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const body = await requireJsonObjectBody<CreateDraftBody>(request);
    if (typeof body.label !== "string") {
        throw new ClientApiError("A draft label is required.");
    }
    const author = await resolveAuthor();
    return ApiSuccess(
        await DbCalendarDraft.create(
            body.label,
            normalizeStoredEvents(body.events),
            author,
            controller,
            iterationId,
        ),
    );
});

/** PUT /api/calendar/drafts — update an existing shared draft's events/label. */
export const PUT = withApi(async (request: Request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const body = await requireJsonObjectBody<UpdateDraftBody>(request);
    if (typeof body.id !== "string") {
        throw new ClientApiError("A draft id is required.");
    }
    if (body.label !== undefined && typeof body.label !== "string") {
        throw new ClientApiError("Draft label must be a string.");
    }
    const author = await resolveAuthor();
    return ApiSuccess(
        await DbCalendarDraft.update(
            body.id,
            normalizeOptionalStoredEvents(body.events),
            author,
            controller,
            body.label,
        ),
    );
});

/** DELETE /api/calendar/drafts?id=<uuid> — remove a shared draft. */
export const DELETE = withApi(async (request: Request) => {
    await requireStaffSession();
    const id = requireIdParam(request, "No draft id provided.");
    const { controller } = await resolveWritableIterationFromRequest(request);
    await DbCalendarDraft.del(id, controller);
    return ApiSuccess();
});
