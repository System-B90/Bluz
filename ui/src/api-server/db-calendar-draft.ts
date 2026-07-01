import { randomUUID } from "crypto";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { CalendarDraft, CalendarDraftSummary } from "@/api-shared/types";
import { DbEventDocument } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

const MAX_DRAFT_EVENTS = 10_000;

export type DraftAuthor = {
    id?: string;
    displayName: string;
};

/**
 * Creates a new shared draft capturing the supplied events. Drafts are shared
 * across all users of the iteration (multi-user).
 */
async function createDraft(
    label: string,
    events: Array<DbEventDocument>,
    author: DraftAuthor,
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<CalendarDraftSummary> {
    const trimmedLabel = label?.trim();
    if (!trimmedLabel) {
        throw new ClientApiError("Draft label is required.");
    }
    if (events.length > MAX_DRAFT_EVENTS) {
        throw new ClientApiError(
            `Draft exceeds the ${MAX_DRAFT_EVENTS}-event limit.`,
        );
    }

    const now = new Date().toISOString();
    const draft: CalendarDraft = {
        id: randomUUID(),
        label: trimmedLabel,
        createdAt: now,
        updatedAt: now,
        updatedBy: author.displayName,
        updatedById: author.id,
        iterationId,
        events: events.map(eventDateFixup),
    };

    await controller.calendarDrafts.insertOne({
        ...draft,
        eventCount: draft.events.length,
    } as never);

    return toSummary(draft);
}

/**
 * Updates an existing shared draft's events (and optionally its label),
 * re-stamping the last editor. Returns the updated summary.
 */
async function updateDraft(
    draftId: string,
    events: Array<DbEventDocument>,
    author: DraftAuthor,
    controller: DatabaseController = databaseController,
    label?: string,
): Promise<CalendarDraftSummary> {
    if (!draftId) {
        throw new ClientApiError("Draft id is missing.");
    }
    if (events.length > MAX_DRAFT_EVENTS) {
        throw new ClientApiError(
            `Draft exceeds the ${MAX_DRAFT_EVENTS}-event limit.`,
        );
    }

    const fixedEvents = events.map(eventDateFixup);
    const now = new Date().toISOString();
    const setFields: Record<string, unknown> = {
        events: fixedEvents,
        eventCount: fixedEvents.length,
        updatedAt: now,
        updatedBy: author.displayName,
        updatedById: author.id,
    };
    const trimmedLabel = label?.trim();
    if (trimmedLabel) {
        setFields.label = trimmedLabel;
    }

    const result = await controller.calendarDrafts.findOneAndUpdate(
        { id: draftId },
        { $set: setFields },
        { returnDocument: "after", projection: { _id: 0 } },
    );
    if (!result) {
        throw new ClientApiError(`Draft ${draftId} not found.`);
    }
    return {
        id: result.id,
        label: result.label,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy,
        updatedById: result.updatedById,
        iterationId: result.iterationId,
        eventCount: fixedEvents.length,
    };
}

/** Lists shared drafts newest-updated-first, without their events payload. */
async function listDrafts(
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<Array<CalendarDraftSummary>> {
    const docs = await controller.calendarDrafts
        .find(
            iterationId ? { iterationId } : {},
            { projection: { events: 0, _id: 0 } },
        )
        .sort({ updatedAt: -1 })
        .toArray();

    return docs.map((doc) => ({
        id: doc.id,
        label: doc.label,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        updatedById: doc.updatedById,
        iterationId: doc.iterationId,
        eventCount: (doc as { eventCount?: number }).eventCount ?? 0,
    }));
}

/** Fetches a single draft including its full events, ready to load. */
async function getDraft(
    draftId: string,
    controller: DatabaseController = databaseController,
): Promise<CalendarDraft> {
    if (!draftId) {
        throw new ClientApiError("Draft id is missing.");
    }
    const doc = await controller.calendarDrafts.findOne(
        { id: draftId },
        { projection: { _id: 0 } },
    );
    if (!doc) {
        throw new ClientApiError(`Draft ${draftId} not found.`);
    }
    return {
        id: doc.id,
        label: doc.label,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        updatedById: doc.updatedById,
        iterationId: doc.iterationId,
        events: (doc.events ?? []).map(eventDateFixup),
    };
}

/** Permanently removes a draft. */
async function deleteDraft(
    draftId: string,
    controller: DatabaseController = databaseController,
): Promise<void> {
    if (!draftId) {
        throw new ClientApiError("Draft id is missing.");
    }
    const result = await controller.calendarDrafts.deleteOne({ id: draftId });
    if (result.deletedCount === 0) {
        throw new ClientApiError(`Draft ${draftId} not found.`);
    }
}

function toSummary(draft: CalendarDraft): CalendarDraftSummary {
    const { events, ...rest } = draft;
    return { ...rest, eventCount: events.length };
}

export namespace DbCalendarDraft {
    export const create = createDraft;
    export const update = updateDraft;
    export const list = listDrafts;
    export const get = getDraft;
    export const del = deleteDraft;
}
