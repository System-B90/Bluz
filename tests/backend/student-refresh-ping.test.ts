import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The server→student ping (#656).
 *
 * Two properties matter and neither is visible from the call site: the ping
 * must carry no calendar payload (students may only receive the projection,
 * which lives behind `/api/student-view/schedule`), and it must fire only for
 * the current iteration, because a student's board has no concept of any
 * other one.
 *
 * The real sender runs against a fake `ws` transport, so what is asserted is
 * the frame actually put on the wire rather than a mocked call.
 */

process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY ??= "test-root-secret";

/** Every frame the sender handed to the transport. */
const wire: Array<string> = [];

vi.mock("ws", () => {
    class FakeSocket {
        static OPEN = 1;
        // Open on construction, so the sender takes its hot path instead of
        // queueing into `pendingMessages` where nothing can observe it.
        readyState = 1;
        onclose?: () => void;
        onerror?: (e: unknown) => void;
        onopen?: () => void;
        close() {}
        send(data: string) {
            wire.push(String(data));
        }
        terminate() {}
    }
    return { WebSocket: FakeSocket };
});

import { NotifyStudentsOfCalendarChange } from "@/api-server/web-socket-utils";
import { MessageTypes, STUDENT_SYNC_ID } from "@/settings";

/** The frames sent, parsed. */
function frames(): Array<Record<string, unknown>> {
    return wire.map((raw) => JSON.parse(raw));
}

beforeAll(() => {
    // The sender opens its socket lazily and queues the first frame until the
    // connection reports open, which the fake transport never does on its own.
    // One warm-up call establishes the socket so each test below exercises the
    // steady-state send path.
    NotifyStudentsOfCalendarChange(undefined);
});

beforeEach(() => {
    wire.length = 0;
});

describe("NotifyStudentsOfCalendarChange", () => {
    it("pings the student channel for a current-iteration write", () => {
        NotifyStudentsOfCalendarChange(undefined);

        expect(frames()).toHaveLength(1);
        expect(frames()[0]).toMatchObject({
            targets: STUDENT_SYNC_ID,
            type: MessageTypes.STUDENT_REFRESH,
        });
    });

    it("carries no payload — the board refetches through the projection", () => {
        NotifyStudentsOfCalendarChange(undefined);

        expect(frames()[0].data ?? null).toBeNull();
    });

    it("stays silent for a past iteration, which no student can view", () => {
        NotifyStudentsOfCalendarChange("2025b");

        expect(wire).toEqual([]);
    });

    it("targets the student channel, never an iteration one", () => {
        NotifyStudentsOfCalendarChange(undefined);

        expect(String(frames()[0].targets)).not.toContain("iteration");
    });

    it("never names an event, a room or a course on the wire", () => {
        NotifyStudentsOfCalendarChange(undefined);

        // The whole frame, authKey and all — nothing calendar-shaped in it.
        const raw = wire[0];
        for (const field of ["events", "eventId", "rooms", "courses", "name"]) {
            expect(raw).not.toContain(field);
        }
    });
});
