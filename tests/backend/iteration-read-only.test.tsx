// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ITERATION_QUERY_PARAM, Iteration } from "@/api-shared/types/iteration";

/**
 * `isReadOnlyIteration` used to be `Boolean(iterationId)` — true whenever the
 * `?iteration=` param was present, even if that id was the *current* run
 * (shared link, refresh, browser back). The "קריאה בלבד" chip then flashed
 * on/off with no relation to which iteration was actually selected. The fix
 * compares the param against the fetched current iteration's id instead.
 */

const iterations: Array<Iteration> = [
    {
        id: "2026a",
        label: "מחזור א׳",
        dbName: "bluz",
        startDate: "2026-01-01",
        endDate: null,
        isCurrent: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
    },
    {
        id: "2025b",
        label: "מחזור ב׳",
        dbName: "bluz_2025b",
        startDate: "2025-01-01",
        endDate: "2025-06-01",
        isCurrent: false,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
    },
];

const apiListIterations = vi.fn(async () => iterations);
vi.mock("@/api-client/iterations", () => ({
    apiListIterations: () => apiListIterations(),
}));

const enqueueSnackbar = vi.fn();
vi.mock("notistack", () => ({
    useSnackbar: () => ({ enqueueSnackbar }),
}));

// The provider subscribes to the session websocket so a "make current" switch
// made elsewhere reaches it (#663). Capture the handler the tests drive.
let messageHandler: ((type: string, data: unknown) => void) | null = null;
const removeMessageHandler = vi.fn();
vi.mock("@/components/auth/AuthProvider", () => ({
    useAuth: () => ({
        addMessageHandler: (handler: (type: string, data: unknown) => void) => {
            messageHandler = handler;
            return removeMessageHandler;
        },
    }),
}));

let searchParam: string | null = null;
const replace = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
    usePathname: () => "/schedule",
    useSearchParams: () => ({
        get: (key: string) =>
            key === ITERATION_QUERY_PARAM ? searchParam : null,
    }),
}));

// Imported after the mocks above so the module picks them up.
const { IterationProvider, useIterationScope } = await import(
    "@/components/base/IterationProvider"
);

function renderScope() {
    return renderHook(() => useIterationScope(), {
        wrapper: ({ children }) => (
            <IterationProvider>{children}</IterationProvider>
        ),
    });
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    searchParam = null;
    messageHandler = null;
    iterations[0].isCurrent = true;
    iterations[1].isCurrent = false;
});

/** Flip which iteration the (mocked) API reports as current. */
function makeCurrent(id: string) {
    iterations.forEach((iteration) => {
        iteration.isCurrent = iteration.id === id;
    });
}

describe("IterationProvider — read-only scoping", () => {
    it("is not read-only for the current run (no param)", async () => {
        searchParam = null;
        const { result } = renderScope();

        await waitFor(() => expect(result.current.currentIterationId).toBe("2026a"));
        expect(result.current.isReadOnlyIteration).toBe(false);
    });

    it("is read-only for a genuinely past iteration", async () => {
        searchParam = "2025b";
        const { result } = renderScope();

        await waitFor(() => expect(result.current.currentIterationId).toBe("2026a"));
        expect(result.current.isReadOnlyIteration).toBe(true);
    });

    it("is NOT read-only when the param names the current iteration's own id", async () => {
        // Regression: shared link / refresh / back-button landing on
        // `?iteration=<currentId>` must not trip the read-only chip.
        searchParam = "2026a";
        const { result } = renderScope();

        await waitFor(() => expect(result.current.currentIterationId).toBe("2026a"));
        expect(result.current.isReadOnlyIteration).toBe(false);
    });

    it("clearing the iteration back to current turns read-only off and backfills the param", async () => {
        searchParam = "2025b";
        const { result } = renderScope();
        await waitFor(() => expect(result.current.currentIterationId).toBe("2026a"));
        expect(result.current.isReadOnlyIteration).toBe(true);

        act(() => result.current.setIterationId(undefined));

        // The param must always be present — an explicit clear is backfilled
        // with the current iteration's own id rather than left empty.
        await waitFor(() => expect(result.current.isReadOnlyIteration).toBe(false));
        expect(result.current.iterationId).toBe("2026a");
    });

    it("backfills the URL param with the current iteration when none is present", async () => {
        searchParam = null;
        const { result } = renderScope();

        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));
        expect(result.current.isReadOnlyIteration).toBe(false);
    });

    it("surfaces a snackbar and keeps a safe default when the iteration list fails to load", async () => {
        apiListIterations.mockRejectedValueOnce(new Error("boom"));
        searchParam = "2025b";
        const { result } = renderScope();

        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        // No current id resolved: falls back to treating any param as read-only
        // rather than silently granting write access.
        expect(result.current.currentIterationId).toBeUndefined();
        expect(result.current.isReadOnlyIteration).toBe(true);
    });
});

/**
 * Switching the current iteration used to leave every already-mounted provider
 * pointed at the previous one until a full page reload (#663). The provider now
 * refetches — and follows the switch — on a CURRENT_ITERATION_CHANGED
 * broadcast.
 */
describe("IterationProvider — current-iteration switch", () => {
    it("follows the switch when scoped to the run that was current", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        makeCurrent("2025b");
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));

        await waitFor(() =>
            expect(result.current.currentIterationId).toBe("2025b"),
        );
        // Followed the switch rather than becoming a read-only view of the
        // iteration that was just demoted.
        expect(result.current.iterationId).toBe("2025b");
        expect(result.current.isReadOnlyIteration).toBe(false);
    });

    it("leaves a deliberately past scope alone", async () => {
        searchParam = "2025b";
        const { result } = renderScope();
        await waitFor(() =>
            expect(result.current.currentIterationId).toBe("2026a"),
        );

        // A third iteration becomes current; the user is reading 2025b on
        // purpose and must not be yanked out of it.
        act(() => messageHandler?.("cic", { iterationId: "2026a" }));

        await waitFor(() => expect(apiListIterations).toHaveBeenCalledTimes(2));
        expect(result.current.iterationId).toBe("2025b");
        expect(result.current.isReadOnlyIteration).toBe(true);
    });

    it("ignores unrelated websocket messages", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        act(() => messageHandler?.("cu", {}));

        expect(apiListIterations).toHaveBeenCalledTimes(1);
    });
});
