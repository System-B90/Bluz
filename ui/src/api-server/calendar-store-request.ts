import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";

/**
 * Coerce a request body's `events` field into stored event documents, fixing up
 * date fields that crossed the wire as strings. Anything else becomes empty.
 */
export function normalizeStoredEvents(
    events: unknown,
): Array<DbEventDocument> {
    return Array.isArray(events)
        ? (events as Array<DbEventDocument>).map(eventDateFixup)
        : [];
}

/**
 * Same coercion for PATCH-style bodies where `events` is optional: an absent
 * key means "keep whatever is stored" and must be distinguishable from an
 * explicit empty list (#512). A present-but-wrong-typed value is a client
 * error, not silently an empty draft.
 */
export function normalizeOptionalStoredEvents(
    events: unknown,
): Array<DbEventDocument> | undefined {
    if (events === undefined || events === null) {
        return undefined;
    }
    if (!Array.isArray(events)) {
        throw new ClientApiError("`events` must be an array when provided.");
    }
    return (events as Array<DbEventDocument>).map(eventDateFixup);
}

/** Read a required `?id=` query param, or reject the request. */
export function requireIdParam(request: Request, missingMessage: string): string {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
        throw new ClientApiError(missingMessage);
    }
    return id;
}
