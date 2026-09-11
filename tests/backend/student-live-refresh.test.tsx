// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The student board's live-update subscription (#656). It must subscribe to
 * the student channel and only that one, and it must treat the ping as a
 * signal to refetch rather than as data.
 */

const addMessageHandler = vi.fn();
const registerSyncObject = vi.fn();
const deregisterSyncObject = vi.fn();

vi.mock("@/components/SessionWs", () => ({
    useSessionWebSocketContext: () => ({
        addMessageHandler,
        deregisterSyncObject,
        registerSyncObject,
    }),
}));

import { MessageTypes, STUDENT_SYNC_ID } from "@/settings";
import { useStudentLiveRefresh } from "@/components/student-view/use-student-live-refresh";

/** The handler the hook registered with the transport. */
let handler: (type: string, data?: unknown) => void;

function Harness({ onChange }: { onChange: () => void }) {
    useStudentLiveRefresh(onChange);
    return null;
}

beforeEach(() => {
    vi.clearAllMocks();
    addMessageHandler.mockImplementation((fn) => {
        handler = fn;
        return () => {};
    });
});

afterEach(cleanup);

describe("useStudentLiveRefresh", () => {
    it("subscribes to the student channel", () => {
        render(<Harness onChange={vi.fn()} />);

        expect(registerSyncObject).toHaveBeenCalledWith(STUDENT_SYNC_ID);
        expect(registerSyncObject).toHaveBeenCalledTimes(1);
    });

    it("subscribes to no iteration channel", () => {
        render(<Harness onChange={vi.fn()} />);

        for (const [syncId] of registerSyncObject.mock.calls) {
            expect(String(syncId)).not.toContain("iteration");
        }
    });

    it("refetches when the ping arrives", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        handler(MessageTypes.STUDENT_REFRESH);

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("ignores any other message type that reaches the socket", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        for (const type of [
            MessageTypes.EVENT_DATA_UPDATE,
            MessageTypes.COURSES_UPDATE,
            MessageTypes.EVENT_LOCK,
        ]) {
            handler(type, { events: { e1: { name: "סודי" } } });
        }

        expect(onChange).not.toHaveBeenCalled();
    });

    it("unsubscribes on unmount so a closed board stops listening", () => {
        const { unmount } = render(<Harness onChange={vi.fn()} />);

        unmount();

        expect(deregisterSyncObject).toHaveBeenCalledWith(STUDENT_SYNC_ID);
    });
});
