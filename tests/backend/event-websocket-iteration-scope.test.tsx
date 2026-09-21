// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Which broadcasts the calendar listens to, and which it accepts (#582).
 *
 * The server and the client spell "the current run" differently. A write to
 * the current iteration is broadcast with no iteration at all — `iterationId:
 * undefined`, targeted at CURRENT_ITERATION_SYNC_ID — while `IterationProvider`
 * backfills `?it=` with the current iteration's real id, so the calendar's
 * scope is that id rather than `undefined`. Treating the scoped id as "some
 * other iteration" silently drops every live update for everyone on the
 * default view, which is exactly what happened: the calendar only refreshed on
 * reload, and the two-user e2e spec could never pass.
 *
 * Installs migrated from before the iteration registry hid half of it: their
 * current iteration's literal id is "current", so the subscription id collided
 * with CURRENT_ITERATION_SYNC_ID by coincidence and frames did arrive — only
 * to be discarded by the match. On an install whose current iteration has an
 * ordinary id, nothing arrived at all.
 */

const addMessageHandler = vi.fn();
const registerSyncObject = vi.fn();
const deregisterSyncObject = vi.fn();

vi.mock("@/components/auth/AuthProvider", () => ({
    useAuth: () => ({
        addMessageHandler,
        deregisterSyncObject,
        registerSyncObject,
    }),
}));

import { CURRENT_ITERATION_SYNC_ID, MessageTypes } from "@/settings";
import { useEventWebsocket } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket";

/** The handler the hook registered with the transport. */
let handler: (type: MessageTypes, data?: unknown) => void;
const dispatch = vi.fn();
const setEventLock = vi.fn();

function Harness({
    activeIterationId,
    currentIterationId,
}: {
    activeIterationId?: string;
    currentIterationId?: string;
}) {
    useEventWebsocket(
        false,
        dispatch,
        setEventLock,
        activeIterationId,
        currentIterationId,
    );
    return null;
}

/** An "event added" broadcast as the server actually sends it. */
function addedFrame(iterationId?: string) {
    return {
        action: "added",
        eventId: "e1",
        iterationId,
        newData: {
            id: "e1",
            name: "שידור",
            startTime: "2026-09-12T08:00:00.000Z",
            endTime: "2026-09-12T08:50:00.000Z",
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    addMessageHandler.mockImplementation((fn) => {
        handler = fn;
        return () => {};
    });
});

afterEach(cleanup);

describe("the calendar subscribes to the channel the server broadcasts on", () => {
    it("uses the current-run channel when nothing is scoped", () => {
        render(<Harness currentIterationId="2026a" />);

        expect(registerSyncObject).toHaveBeenCalledWith(
            CURRENT_ITERATION_SYNC_ID,
        );
    });

    it("uses it when scoped to the current iteration by its own id", () => {
        // The state IterationProvider actually produces: `?it=` backfilled
        // with the current iteration's id. Subscribing to `iteration:2026a`
        // here would mean never receiving a current-run broadcast at all.
        render(
            <Harness activeIterationId="2026a" currentIterationId="2026a" />,
        );

        expect(registerSyncObject).toHaveBeenCalledWith(
            CURRENT_ITERATION_SYNC_ID,
        );
    });

    it("uses the per-iteration channel for any other iteration", () => {
        render(
            <Harness activeIterationId="2025b" currentIterationId="2026a" />,
        );

        expect(registerSyncObject).toHaveBeenCalledWith("iteration:2025b");
    });
});

describe("the calendar accepts the broadcasts meant for it", () => {
    it("applies an unscoped broadcast while scoped to the current id", () => {
        render(
            <Harness activeIterationId="2026a" currentIterationId="2026a" />,
        );

        handler(MessageTypes.EVENT_ADDED_OR_REMOVED, addedFrame(undefined));

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: "UPSERT_EVENT" }),
        );
    });

    it("applies one that names the current iteration explicitly", () => {
        // Client-relayed frames (the lock relay) carry the scope the sender
        // was on, so both spellings have to be accepted.
        render(
            <Harness activeIterationId="2026a" currentIterationId="2026a" />,
        );

        handler(MessageTypes.EVENT_ADDED_OR_REMOVED, addedFrame("2026a"));

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: "UPSERT_EVENT" }),
        );
    });

    it("applies an unscoped broadcast when nothing is scoped", () => {
        render(<Harness currentIterationId="2026a" />);

        handler(MessageTypes.EVENT_ADDED_OR_REMOVED, addedFrame(undefined));

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: "UPSERT_EVENT" }),
        );
    });

    it("ignores one for a different iteration", () => {
        render(
            <Harness activeIterationId="2026a" currentIterationId="2026a" />,
        );

        handler(MessageTypes.EVENT_ADDED_OR_REMOVED, addedFrame("2025b"));

        expect(dispatch).not.toHaveBeenCalled();
    });

    it("ignores a current-run broadcast while viewing a past iteration", () => {
        // The guarantee #525 added: a past iteration's calendar must not be
        // rewritten by writes landing on the current run.
        render(
            <Harness activeIterationId="2025b" currentIterationId="2026a" />,
        );

        handler(MessageTypes.EVENT_ADDED_OR_REMOVED, addedFrame(undefined));

        expect(dispatch).not.toHaveBeenCalled();
    });
});
