import { describe, it, expect, vi, beforeEach } from "vitest";

import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

/**
 * Optimistic-update behaviour of the shared entity action factory (#328).
 *
 * The point of these tests is the *rollback* paths: an optimistic dispatch is
 * invisible in normal use, and a broken rollback only shows up when the API
 * fails, which no e2e run exercises. Each "regression" case below pins one
 * behaviour that a plausible refactor would silently break.
 */

type TestEntity = { id: string; title: string; allocatedDuration?: number };

function buildActions(
    overrides: {
        api?: Partial<Record<string, unknown>>;
        getEntity?: (id: string) => TestEntity | undefined;
        getAllocatedTime?: (id: string) => number | undefined;
    } = {},
) {
    const dispatch = vi.fn();
    const api = {
        apiCreate: vi.fn(),
        apiUpdate: vi.fn(),
        apiDelete: vi.fn(),
        apiLink: vi.fn(),
        apiUnlink: vi.fn(),
        apiSetAllocatedTime: vi.fn(),
        ...overrides.api,
    };

    const actions = makeEntityActions<TestEntity, string, { title: string }>({
        api: api as never,
        dispatch,
        label: "test",
        containerLabel: "container",
        getEntity: overrides.getEntity,
        getAllocatedTime: overrides.getAllocatedTime,
        builders: {
            add: (entity, containerId) => ({
                type: "ADD",
                payload: { entity, containerId },
            }) as never,
            update: (id, updates) => ({
                type: "UPDATE",
                payload: { id, updates },
            }) as never,
            remove: (containerId, id) => ({
                type: "REMOVE",
                payload: { containerId, id },
            }) as never,
            allocateTime: (id, curriculumId, duration) => ({
                type: "ALLOCATE",
                payload: { id, curriculumId, duration },
            }) as never,
        },
    });

    return { actions, dispatch, api };
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("makeEntityActions - optimistic unlink (#328)", () => {
    const existing: TestEntity = { id: "e_1", title: "Existing" };

    it("dispatches the removal before the API call resolves", async () => {
        let resolveUnlink: () => void = () => {};
        const apiUnlink = vi.fn(
            () => new Promise<void>((resolve) => (resolveUnlink = resolve)),
        );
        const { actions, dispatch } = buildActions({
            api: { apiUnlink },
            getEntity: () => existing,
        });

        const pending = actions.unlink("c_1", "e_1");

        // The whole point: state already reflects the unlink while the request
        // is still in flight.
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE",
            payload: { containerId: "c_1", id: "e_1" },
        });

        resolveUnlink();
        await pending;
    });

    it("does not dispatch twice on success", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiUnlink: vi.fn().mockResolvedValue(undefined) },
            getEntity: () => existing,
        });

        await actions.unlink("c_1", "e_1");

        // REGRESSION: the optimistic dispatch replaced the post-await one.
        // Dispatching in both places would remove the item twice, which for a
        // filter-based reducer is a no-op today but would corrupt any
        // count- or index-based handler added later.
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it("re-adds the snapshot when the API call fails", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiUnlink: vi.fn().mockRejectedValue(new Error("boom")) },
            getEntity: () => existing,
        });

        await expect(actions.unlink("c_1", "e_1")).rejects.toThrow("boom");

        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: "REMOVE",
            payload: { containerId: "c_1", id: "e_1" },
        });
        // REGRESSION: rollback must restore the *entity*, not just its id —
        // `add` needs the whole object to put the doc back in the container.
        expect(dispatch).toHaveBeenNthCalledWith(2, {
            type: "ADD",
            payload: { entity: existing, containerId: "c_1" },
        });
    });

    it("still rethrows the original error after rolling back", async () => {
        const error = new Error("network down");
        const { actions } = buildActions({
            api: { apiUnlink: vi.fn().mockRejectedValue(error) },
            getEntity: () => existing,
        });

        // REGRESSION: callers show snackbars off the rejection; swallowing it
        // during rollback would make failures silent.
        await expect(actions.unlink("c_1", "e_1")).rejects.toBe(error);
    });

    it("falls back to non-optimistic when no snapshot is available", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiUnlink: vi.fn().mockResolvedValue(undefined) },
            getEntity: () => undefined,
        });

        await actions.unlink("c_1", "e_1");

        // Without a snapshot there is nothing to roll back to, so the removal
        // must wait for the server rather than risk an unrecoverable state.
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE",
            payload: { containerId: "c_1", id: "e_1" },
        });
    });

    it("does not dispatch a removal at all when a snapshot-less unlink fails", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiUnlink: vi.fn().mockRejectedValue(new Error("boom")) },
            getEntity: () => undefined,
        });

        await expect(actions.unlink("c_1", "e_1")).rejects.toThrow("boom");
        expect(dispatch).not.toHaveBeenCalled();
    });
});

describe("makeEntityActions - optimistic allocateTime (#328)", () => {
    it("applies the new duration before the API resolves", async () => {
        let resolveCall: () => void = () => {};
        const apiSetAllocatedTime = vi.fn(
            () => new Promise<void>((resolve) => (resolveCall = resolve)),
        );
        const { actions, dispatch } = buildActions({
            api: { apiSetAllocatedTime },
            getAllocatedTime: () => 30,
        });

        const pending = actions.allocateTime("e_1", "c_1" as never, 90);

        expect(dispatch).toHaveBeenCalledWith({
            type: "ALLOCATE",
            payload: { id: "e_1", curriculumId: "c_1", duration: 90 },
        });

        resolveCall();
        await pending;
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it("restores the previous duration on failure", async () => {
        const { actions, dispatch } = buildActions({
            api: {
                apiSetAllocatedTime: vi
                    .fn()
                    .mockRejectedValue(new Error("boom")),
            },
            getAllocatedTime: () => 30,
        });

        await expect(
            actions.allocateTime("e_1", "c_1" as never, 90),
        ).rejects.toThrow("boom");

        // REGRESSION: the rollback must send the *snapshot* value, not the
        // attempted one — dispatching 90 again would leave the failed edit
        // applied.
        expect(dispatch).toHaveBeenNthCalledWith(2, {
            type: "ALLOCATE",
            payload: { id: "e_1", curriculumId: "c_1", duration: 30 },
        });
    });

    it("rolls back correctly when the previous duration was zero", async () => {
        const { actions, dispatch } = buildActions({
            api: {
                apiSetAllocatedTime: vi
                    .fn()
                    .mockRejectedValue(new Error("boom")),
            },
            getAllocatedTime: () => 0,
        });

        await expect(
            actions.allocateTime("e_1", "c_1" as never, 45),
        ).rejects.toThrow("boom");

        // REGRESSION: 0 is falsy. A truthiness check instead of an
        // `undefined` check would skip both the optimistic dispatch and this
        // rollback, stranding the UI at 45.
        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: "ALLOCATE",
            payload: { id: "e_1", curriculumId: "c_1", duration: 45 },
        });
        expect(dispatch).toHaveBeenNthCalledWith(2, {
            type: "ALLOCATE",
            payload: { id: "e_1", curriculumId: "c_1", duration: 0 },
        });
    });

    it("stays non-optimistic when no prior value is readable", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiSetAllocatedTime: vi.fn().mockResolvedValue(undefined) },
            getAllocatedTime: () => undefined,
        });

        await actions.allocateTime("m_1", "c_1" as never, 90);

        // REGRESSION: modules deliberately omit `getAllocatedTime` because
        // ALLOCATE_TIME_TO_MODULE redistributes across children and cannot be
        // undone with a single number. They must keep awaiting the server.
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
            type: "ALLOCATE",
            payload: { id: "m_1", curriculumId: "c_1", duration: 90 },
        });
    });

    it("dispatches nothing when a non-optimistic allocation fails", async () => {
        const { actions, dispatch } = buildActions({
            api: {
                apiSetAllocatedTime: vi
                    .fn()
                    .mockRejectedValue(new Error("boom")),
            },
            getAllocatedTime: () => undefined,
        });

        await expect(
            actions.allocateTime("m_1", "c_1" as never, 90),
        ).rejects.toThrow("boom");
        expect(dispatch).not.toHaveBeenCalled();
    });
});

describe("makeEntityActions - update stays optimistic (#327 regression)", () => {
    const existing: TestEntity = { id: "e_1", title: "Before" };

    it("rolls back only the touched keys", async () => {
        const { actions, dispatch } = buildActions({
            api: { apiUpdate: vi.fn().mockRejectedValue(new Error("boom")) },
            getEntity: () => existing,
        });

        await expect(
            actions.update("e_1", { title: "After" }),
        ).rejects.toThrow("boom");

        expect(dispatch).toHaveBeenNthCalledWith(2, {
            type: "UPDATE",
            payload: { id: "e_1", updates: { title: "Before" } },
        });
    });

    it("ignores a stale response superseded by a newer edit", async () => {
        let resolveFirst: (value: TestEntity) => void = () => {};
        const apiUpdate = vi
            .fn()
            .mockImplementationOnce(
                () => new Promise((resolve) => (resolveFirst = resolve)),
            )
            .mockResolvedValueOnce({ id: "e_1", title: "Second" });

        const { actions, dispatch } = buildActions({
            api: { apiUpdate },
            getEntity: () => existing,
        });

        const first = actions.update("e_1", { title: "First" });
        await actions.update("e_1", { title: "Second" });
        resolveFirst({ id: "e_1", title: "First" });
        await first;

        // REGRESSION: the slow first response must not clobber the newer
        // edit. No dispatch may carry "First" after the second update ran.
        const dispatchedTitles = dispatch.mock.calls.map(
            ([action]) => (action as { payload: { updates?: TestEntity } })
                .payload.updates?.title,
        );
        expect(dispatchedTitles.lastIndexOf("First")).toBeLessThan(
            dispatchedTitles.lastIndexOf("Second"),
        );
    });
});
