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

// Returns fresh objects each call, like a real fetch would. Returning the
// same array reference made two tests below flake: React bails out of a
// re-render when `setIterations` receives an object identical (`Object.is`)
// to the current state, so a refetch that isn't paired with some other state
// change (e.g. no `setIterationId`) would appear to do nothing even though
// the mutation it fetched was real.
const apiListIterations = vi.fn(async () => iterations.map((i) => ({ ...i })));
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

    it("still refetches when the message carries no iteration id", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        // Nothing to follow, but read-only mode is decided by the *fetched*
        // current id — leaving it stale is the #663 failure in miniature.
        makeCurrent("2025b");
        act(() => messageHandler?.("cic", {}));

        await waitFor(() =>
            expect(result.current.currentIterationId).toBe("2025b"),
        );
        // The scope stayed on the demoted run, so it is now genuinely read-only.
        expect(result.current.iterationId).toBe("2026a");
        expect(result.current.isReadOnlyIteration).toBe(true);
    });

    it("is a no-op when the scope already names the newly current iteration", async () => {
        searchParam = "2025b";
        const { result } = renderScope();
        await waitFor(() =>
            expect(result.current.currentIterationId).toBe("2026a"),
        );
        expect(result.current.isReadOnlyIteration).toBe(true);
        replace.mockClear();

        // The iteration the user is pinned to becomes the current one.
        makeCurrent("2025b");
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));

        await waitFor(() =>
            expect(result.current.isReadOnlyIteration).toBe(false),
        );
        expect(result.current.iterationId).toBe("2025b");
        // No scope change, so no URL rewrite either.
        expect(replace).not.toHaveBeenCalled();
    });

    it("follows a second switch, not just the first", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        makeCurrent("2025b");
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));
        // Wait for currentIterationId too, not just iterationId: the two land
        // on different ticks (setIterationId vs. the loadIterations refetch).
        // Firing the second switch before currentIterationIdRef has caught up
        // would make onIterationChanged compare against the *stale* pre-switch
        // value and wrongly conclude the scope is "a deliberately past
        // iteration" — see the note on that ref in IterationProvider.
        await waitFor(() => {
            expect(result.current.iterationId).toBe("2025b");
            expect(result.current.currentIterationId).toBe("2025b");
        });

        makeCurrent("2026a");
        act(() => messageHandler?.("cic", { iterationId: "2026a" }));

        // `iterationId` (from the switch's own setIterationId) and
        // `currentIterationId` (from the switch's loadIterations refetch) land
        // on different ticks — wait for the read-only flag itself, which is
        // only false once both have actually settled.
        await waitFor(() =>
            expect(result.current.isReadOnlyIteration).toBe(false),
        );
        expect(result.current.iterationId).toBe("2026a");
        expect(apiListIterations).toHaveBeenCalledTimes(3);
    });

    it("mirrors the followed switch into the URL param", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));
        replace.mockClear();

        makeCurrent("2025b");
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));

        await waitFor(() => expect(replace).toHaveBeenCalled());
        // A reload after the switch must land on the iteration the app moved
        // to, not the one the URL was written with at mount.
        expect(String(replace.mock.calls.at(-1)?.[0])).toContain("2025b");
    });

    it("keeps working when the refetch triggered by the switch fails", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        apiListIterations.mockRejectedValueOnce(new Error("network down"));
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));

        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        // The list is stale, but the scope still followed the switch, so the
        // app is not left silently writing into the demoted iteration.
        expect(result.current.iterationId).toBe("2025b");
        expect(result.current.iterations).toHaveLength(2);
    });

    it("stops listening once unmounted", async () => {
        searchParam = null;
        const { result, unmount } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        unmount();
        expect(removeMessageHandler).toHaveBeenCalled();
    });

    /**
     * Known race, not yet fixed: `onIterationChanged` decides whether the
     * scope is "following the current run" by comparing it against
     * `currentIterationIdRef.current` — the value from the *last completed*
     * `loadIterations()` fetch. If a second CURRENT_ITERATION_CHANGED arrives
     * before that fetch resolves, the ref still holds the pre-switch id, so
     * the second broadcast looks identical to "the user deliberately pinned
     * this scope to a past iteration" and is dropped — the provider silently
     * stops following, and isReadOnlyIteration flips on for a run that is
     * actually still current. Plausible whenever two admins (or one admin,
     * twice) flip the current iteration within one request round-trip. Filed
     * as a follow-up to #666, not fixed here.
     */
    it("follows a second switch that arrives before the first's refetch settles (#667)", async () => {
        searchParam = null;
        const { result } = renderScope();
        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));

        makeCurrent("2025b");
        act(() => messageHandler?.("cic", { iterationId: "2025b" }));
        // Second switch fired immediately — before the first's loadIterations
        // promise has resolved, so currentIterationIdRef is still "2026a".
        makeCurrent("2026a");
        act(() => messageHandler?.("cic", { iterationId: "2026a" }));

        await waitFor(() =>
            expect(apiListIterations).toHaveBeenCalledTimes(3),
        );

        await waitFor(() => expect(result.current.iterationId).toBe("2026a"));
        await waitFor(() =>
            expect(result.current.isReadOnlyIteration).toBe(false),
        );
    });
});
