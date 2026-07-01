export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import {
    DbCalendarDraft,
    DraftAuthor,
} from "@/api-server/db-calendar-draft";
import { resolveIterationFromRequest } from "@/api-server/iteration-request";
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
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const { controller } = await resolveIterationFromRequest(request);

        if (id) {
            return ApiSuccess(
                await DbCalendarDraft.get(id, controller),
                "no-store",
            );
        }
        return ApiSuccess(await DbCalendarDraft.list(controller), "no-store");
    } catch (e) {
        return catchHandler(request as never, e);
    }
}

/** POST /api/calendar/drafts — create a new shared draft. */
export async function POST(request: Request) {
    try {
        const { controller, iterationId } =
            await resolveIterationFromRequest(request);
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
    } catch (e) {
        return catchHandler(request as never, e);
    }
}

/** PUT /api/calendar/drafts — update an existing shared draft's events/label. */
export async function PUT(request: Request) {
    try {
        const { controller } = await resolveIterationFromRequest(request);
        const body = (await request.json()) as UpdateDraftBody;
        if (!body || typeof body.id !== "string") {
            throw new ClientApiError("A draft id is required.");
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
    } catch (e) {
        return catchHandler(request as never, e);
    }
}

/** DELETE /api/calendar/drafts?id=<uuid> — remove a shared draft. */
export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
            throw new ClientApiError("No draft id provided.");
        }
        const { controller } = await resolveIterationFromRequest(request);
        await DbCalendarDraft.del(id, controller);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request as never, e);
    }
}
