export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";

type CreateSnapshotBody = {
    label: string;
    events: Array<DbEventDocument>;
};

/**
 * GET /api/calendar/snapshots
 *   - no params  → list snapshots (summaries, newest first)
 *   - ?id=<uuid> → fetch one snapshot including its captured events (for restore)
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const { controller, iterationId } =
            await resolveIterationFromRequest(request);

        if (id) {
            return ApiSuccess(
                await DbCalendarSnapshot.get(id, controller),
                "no-store",
            );
        }
        return ApiSuccess(
            await DbCalendarSnapshot.list(controller, iterationId),
            "no-store",
        );
    } catch (e) {
        return catchHandler(request as never, e);
    }
}

/** POST /api/calendar/snapshots — create a snapshot from the supplied events. */
export async function POST(request: Request) {
    try {
        const { controller, iterationId } =
            await resolveWritableIterationFromRequest(request);
        const body = (await request.json()) as CreateSnapshotBody;
        if (!body || typeof body.label !== "string") {
            throw new ClientApiError("A snapshot label is required.");
        }
        const events = Array.isArray(body.events)
            ? body.events.map(eventDateFixup)
            : [];

        return ApiSuccess(
            await DbCalendarSnapshot.create(
                body.label,
                events,
                controller,
                iterationId,
            ),
        );
    } catch (e) {
        return catchHandler(request as never, e);
    }
}

/** DELETE /api/calendar/snapshots?id=<uuid> — remove a snapshot. */
export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
            throw new ClientApiError("No snapshot id provided.");
        }
        const { controller } = await resolveWritableIterationFromRequest(
            request,
        );
        await DbCalendarSnapshot.del(id, controller);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request as never, e);
    }
}
