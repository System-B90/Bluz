import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiCreateEvent,
    apiDeleteEvent,
    apiUpdateEvent,
    withInitiator,
} from "@/api-client/calendar";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    EVENT_INITIATOR_HEADER,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";

/**
 * Client-side half of the change-log wiring: every event write may declare the
 * user action that produced it, sent as a header so the body stays the event
 * document (and so DELETE, which carries only an id, can declare one too).
 */

function mockFetch(data: unknown = {}) {
    return vi.fn(async () => ({
        json: async () => ({ data, status: 0 }),
        redirected: false,
    }));
}

function headerOf(fetchMock: ReturnType<typeof mockFetch>): null | string {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return new Headers(init.headers).get(EVENT_INITIATOR_HEADER);
}

const event = {
    endTime: new Date("2024-01-07T09:00:00.000Z"),
    id: "e1",
    startTime: new Date("2024-01-07T08:00:00.000Z"),
} as DbEventDocument;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("withInitiator", () => {
    it("adds the header without dropping caller-supplied props", () => {
        const props = withInitiator(
            { headers: { "X-Other": "keep" }, keepalive: true },
            EventChangeInitiator.Resize,
        );

        expect(new Headers(props.headers).get(EVENT_INITIATOR_HEADER)).toBe(
            EventChangeInitiator.Resize,
        );
        expect(new Headers(props.headers).get("X-Other")).toBe("keep");
        expect(props.keepalive).toBe(true);
    });

    it("is a no-op when no initiator is declared", () => {
        expect(withInitiator(undefined)).toEqual({});
        expect(
            new Headers(withInitiator({ headers: {} }).headers).get(
                EVENT_INITIATOR_HEADER,
            ),
        ).toBeNull();
    });
});

describe("event write clients", () => {
    it("sends the initiator on a create", async () => {
        const fetchMock = mockFetch(event);
        vi.stubGlobal("fetch", fetchMock);

        await apiCreateEvent(event, EventChangeInitiator.CopyPaste);

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/event");
        expect(init.method).toBe("PUT");
        expect(headerOf(fetchMock)).toBe(EventChangeInitiator.CopyPaste);
    });

    it("sends the initiator on an update", async () => {
        const fetchMock = mockFetch(event);
        vi.stubGlobal("fetch", fetchMock);

        await apiUpdateEvent(event, EventChangeInitiator.DragDrop);

        expect(headerOf(fetchMock)).toBe(EventChangeInitiator.DragDrop);
    });

    it("sends the initiator on a delete", async () => {
        const fetchMock = mockFetch(undefined);
        vi.stubGlobal("fetch", fetchMock);

        await apiDeleteEvent("e1", EventChangeInitiator.Keyboard);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("DELETE");
        expect(headerOf(fetchMock)).toBe(EventChangeInitiator.Keyboard);
    });

    it("omits the header entirely when no initiator is given", async () => {
        const fetchMock = mockFetch(event);
        vi.stubGlobal("fetch", fetchMock);

        await apiUpdateEvent(event);

        expect(headerOf(fetchMock)).toBeNull();
    });
});
