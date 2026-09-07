// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageTypes } from "@/settings";

/**
 * Every per-iteration collection (rooms, outsiders, custom colours, the course
 * builder) is built on `createCollectionProvider`, and each item in its store
 * was resolved against whichever iteration was current when it loaded. A
 * "make current" switch elsewhere therefore invalidates the whole store, not
 * individual rows — before #663 the provider ignored the switch and kept
 * serving the previous iteration's data until a full page reload.
 */

const enqueueSnackbar = vi.fn();
vi.mock("notistack", () => ({
    useSnackbar: () => ({ enqueueSnackbar }),
}));

let messageHandler: ((type: MessageTypes, data: unknown) => void) | null = null;
const removeMessageHandler = vi.fn();
vi.mock("@/components/auth/AuthProvider", () => ({
    useAuth: () => ({
        addMessageHandler: (
            handler: (type: MessageTypes, data: unknown) => void,
        ) => {
            messageHandler = handler;
            return removeMessageHandler;
        },
    }),
}));

const { createCollectionProvider } = await import(
    "@/components/base/collection/create-collection-provider"
);

type Row = { id: string; name: string };

/** Rows the (mocked) API returns on the next `list()`. */
let serverRows: Array<Row> = [];
const list = vi.fn(async () => serverRows);

function buildProvider() {
    return createCollectionProvider<Row, string, Row>({
        api: {
            list,
            create: async (item) => item,
            update: async (item) => item,
            remove: async () => {},
        },
        getKey: (item) => item.id,
        getId: (item) => item.id,
        getLabel: (item) => item.name,
        buildItem: (data) => data,
        messages: {
            loadFailed: "טעינה נכשלה",
            createSuccess: (l) => l,
            createFailure: (l) => l,
            updateSuccess: (l) => l,
            updateFailure: (l) => l,
            deleteSuccess: (l) => l,
            deleteFailure: (l) => l,
        },
        websocket: {
            messageType: MessageTypes.ROOMS_UPDATE,
            payloadKey: "rooms",
        },
    });
}

function renderCollection() {
    const { Provider, useCollection } = buildProvider();
    return renderHook(() => useCollection("useTestCollection"), {
        wrapper: ({ children }) => <Provider>{children}</Provider>,
    });
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    messageHandler = null;
    serverRows = [];
});

describe("createCollectionProvider — current-iteration switch (#663)", () => {
    it("drops the store and refetches when the current iteration changes", async () => {
        serverRows = [ { id: "r1", name: "כיתה א" } ];
        const { result } = renderCollection();

        await waitFor(() => expect(result.current.items).toHaveLength(1));
        expect(list).toHaveBeenCalledTimes(1);

        // The new iteration has an entirely different set of rooms.
        serverRows = [ { id: "r9", name: "כיתה ט" } ];
        await act(async () => {
            messageHandler?.(MessageTypes.CURRENT_ITERATION_CHANGED, {});
        });

        await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(result.current.items).toEqual([ { id: "r9", name: "כיתה ט" } ]),
        );
    });

    it("does not carry a stale row over when the new iteration drops it", async () => {
        serverRows = [
            { id: "r1", name: "כיתה א" },
            { id: "r2", name: "כיתה ב" },
        ];
        const { result } = renderCollection();
        await waitFor(() => expect(result.current.items).toHaveLength(2));

        serverRows = [];
        await act(async () => {
            messageHandler?.(MessageTypes.CURRENT_ITERATION_CHANGED, {});
        });

        await waitFor(() => expect(result.current.items).toHaveLength(0));
        expect(result.current.getItem("r1")).toBeUndefined();
    });

    it("refetches on every switch, not only the first", async () => {
        serverRows = [ { id: "r1", name: "כיתה א" } ];
        const { result } = renderCollection();
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        serverRows = [ { id: "r2", name: "כיתה ב" } ];
        await act(async () => {
            messageHandler?.(MessageTypes.CURRENT_ITERATION_CHANGED, {});
        });
        await waitFor(() => expect(result.current.getItem("r2")).toBeTruthy());

        serverRows = [ { id: "r3", name: "כיתה ג" } ];
        await act(async () => {
            messageHandler?.(MessageTypes.CURRENT_ITERATION_CHANGED, {});
        });

        await waitFor(() => expect(result.current.getItem("r3")).toBeTruthy());
        expect(result.current.items).toHaveLength(1);
        expect(list).toHaveBeenCalledTimes(3);
    });

    it("does not resurrect the previous iteration's rows when a write fails after the switch", async () => {
        // The rollback snapshot is taken before the request. If a switch lands
        // in between, restoring that snapshot would put rows belonging to the
        // *previous* iteration back on screen — under a curriculum they were
        // never part of.
        serverRows = [ { id: "old", name: "ישן" } ];
        const { result } = renderCollection();
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        serverRows = [ { id: "new", name: "חדש" } ];
        let failWrite: (reason: Error) => void = () => {};
        const pending = new Promise<void>((_, reject) => {
            failWrite = reject;
        });

        let mutation!: Promise<void>;
        await act(async () => {
            mutation = result.current.mutate({
                optimistic: (ops) => ops.remove("old"),
                request: () => pending,
                successMessage: "ok",
                failureMessage: "נכשל",
            });
        });

        await act(async () => {
            messageHandler?.(MessageTypes.CURRENT_ITERATION_CHANGED, {});
        });
        await waitFor(() => expect(result.current.getItem("new")).toBeTruthy());

        await act(async () => {
            failWrite(new Error("rejected: read-only iteration"));
            await mutation;
        });

        await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
        await waitFor(() =>
            expect(result.current.items).toEqual([ { id: "new", name: "חדש" } ]),
        );
        expect(result.current.getItem("old")).toBeUndefined();
    });

    it("stops listening once unmounted", async () => {
        serverRows = [ { id: "r1", name: "כיתה א" } ];
        const { result, unmount } = renderCollection();
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        unmount();
        expect(removeMessageHandler).toHaveBeenCalled();
    });

    it("still applies its own incremental updates, and ignores other messages", async () => {
        serverRows = [ { id: "r1", name: "כיתה א" } ];
        const { result } = renderCollection();
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        await act(async () => {
            messageHandler?.(MessageTypes.ROOMS_UPDATE, {
                rooms: { r2: { id: "r2", name: "כיתה ב" } },
            });
        });
        await waitFor(() => expect(result.current.items).toHaveLength(2));
        // Incremental, so no refetch.
        expect(list).toHaveBeenCalledTimes(1);

        await act(async () => {
            messageHandler?.(MessageTypes.EVENT_DATA_UPDATE, {});
        });
        expect(list).toHaveBeenCalledTimes(1);
        expect(result.current.items).toHaveLength(2);
    });
});
