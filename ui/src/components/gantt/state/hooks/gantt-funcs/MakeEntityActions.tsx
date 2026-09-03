import { Dispatch } from "react";

import { BasicGantApi } from "@/api-client/gantt/base";
import {
    BaseGantItem,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { Action } from "@/components/gantt/state/reducer";

/**
 * Per-entity dispatch builders. Payload key names differ per entity
 * (e.g. ADD_MODULE carries `{ module, syllabusId }` while ADD_EVENT carries
 * `{ event, moduleId }`), so each hook maps the generic call into its
 * reducer action here.
 */
export type EntityActionBuilders<
    TEntity extends BaseGantItem,
    TContainerId extends BaseGantItem["id"],
> = {
    add: (entity: TEntity, containerId: TContainerId) => Action;
    update: (id: TEntity["id"], updates: Partial<TEntity>) => Action;
    remove: (containerId: TContainerId, id: TEntity["id"]) => Action;
    /**
     * Deletes a doc outright rather than unlinking it from `containerId`
     * (unlike `remove`). Used to undo an optimistic `create` by discarding
     * its temp entity — see `create`'s `buildOptimistic` parameter (#381).
     */
    discard?: (id: TEntity["id"]) => Action;
    allocateTime?: (
        id: TEntity["id"],
        curriculumId: GanttCurriculumId,
        duration: number,
    ) => Action;
};

export type MakeEntityActionsProps<
    TEntity extends BaseGantItem,
    TContainerId extends BaseGantItem["id"],
    TCreatePayload,
> = {
    api: BasicGantApi<TEntity, TCreatePayload>;
    dispatch: Dispatch<Action>;
    /** Entity name used in error messages, e.g. "module". */
    label: string;
    /** Container name used in link/unlink error messages, e.g. "syllabus". */
    containerLabel: string;
    builders: EntityActionBuilders<TEntity, TContainerId>;
    /**
     * Reads the current entity from the store. When provided, `update` becomes
     * optimistic: it snapshots these values, dispatches immediately, and rolls
     * back on failure — like `updateWeek` (#327, #328). Must be stable (e.g. a
     * ref-backed useCallback) so the returned actions stay memoized.
     */
    getEntity?: (id: TEntity["id"]) => TEntity | undefined;
    /**
     * Reads the entity's current allocated duration. When provided,
     * `allocateTime` becomes optimistic and rolls back to this value on
     * failure.
     *
     * Only supply it when `builders.allocateTime` maps to a *scalar* reducer
     * action. Events qualify (`ALLOCATE_TIME` writes one field); modules do
     * not — `ALLOCATE_TIME_TO_MODULE` redistributes time across every child
     * event, so restoring a single number would not undo it. Modules
     * therefore omit this and keep waiting on the server (#328).
     */
    getAllocatedTime?: (id: TEntity["id"]) => number | undefined;
};

/**
 * Factors the "call gantt API → dispatch reducer action" pattern shared by the
 * module/syllabus/event action hooks (#190) so behavior fixes land in one
 * place. Entity-specific flows (optimistic week updates, event move/duplicate,
 * create-payload defaults) stay in their hooks.
 */
export function makeEntityActions<
    TEntity extends BaseGantItem,
    TContainerId extends BaseGantItem["id"],
    TCreatePayload,
>({
    api,
    dispatch,
    label,
    containerLabel,
    builders,
    getEntity,
    getAllocatedTime,
}: MakeEntityActionsProps<TEntity, TContainerId, TCreatePayload>) {
    // Per-id sequence guarding against out-of-order responses: a slow PATCH must
    // not clobber a newer edit made while it was in flight (#327). Persists for
    // the lifetime of this (memoized) actions object.
    const updateSeqById = new Map<TEntity["id"], number>();

    const create = async (
        payload: TCreatePayload,
        containerId: TContainerId,
        /**
         * When given (together with `builders.discard`), `create` becomes
         * optimistic: it renders a temp entity immediately, then on success
         * discards the temp doc and adds the real one, or on failure just
         * discards it — mirroring `createWeek`'s temp-id + swap pattern
         * (#381). Without it, `create` stays non-optimistic: wait for the
         * API, then add the real entity.
         */
        buildOptimistic?: (tempId: TEntity["id"]) => TEntity,
    ) => {
        const buildDiscard = builders.discard;
        if (!buildOptimistic || !buildDiscard) {
            return await withGantErrorHandling(async () => {
                const entity = await api.apiCreate(payload);
                dispatch(builders.add(entity, containerId));
                return entity;
            }, `Failed to create ${label}:`);
        }

        const tempId = `temp-${label}-${crypto.randomUUID()}` as TEntity["id"];
        dispatch(builders.add(buildOptimistic(tempId), containerId));

        try {
            const entity = await api.apiCreate(payload);
            dispatch(buildDiscard(tempId));
            dispatch(builders.add(entity, containerId));
            return entity;
        } catch (error) {
            dispatch(buildDiscard(tempId));
            console.error(`Failed to create ${label}:`, error);
            throw error;
        }
    };

    const update = async (id: TEntity["id"], updates: Partial<TEntity>) => {
        const seq = (updateSeqById.get(id) ?? 0) + 1;
        updateSeqById.set(id, seq);
        const isLatest = () => updateSeqById.get(id) === seq;

        // Snapshot the touched keys so we can roll back the optimistic change.
        const snapshot = getEntity?.(id);
        if (snapshot) {
            // Optimistically apply so the UI reacts instantly instead of
            // waiting on the round-trip (#327).
            dispatch(builders.update(id, updates));
        }

        try {
            const updated = await api.apiUpdate({ id, ...updates });
            // Skip a stale response that a newer edit has already superseded.
            if (isLatest()) dispatch(builders.update(id, updated));
            return updated;
        } catch (error) {
            // Roll back the optimistic change, unless a newer edit is pending.
            if (snapshot && isLatest()) {
                const rollback: Partial<TEntity> = {};
                for (const key of Object.keys(updates) as Array<keyof TEntity>) {
                    rollback[key] = snapshot[key];
                }
                dispatch(builders.update(id, rollback));
            }
            console.error(`Failed to update ${label} (ID: ${id}):`, error);
            throw error;
        }
    };

    const remove = async (containerId: TContainerId, id: TEntity["id"]) =>
        await withGantErrorHandling(async () => {
            await api.apiDelete(id);
            dispatch(builders.remove(containerId, id));
        }, `Failed to remove ${label} (ID: ${id}):`);

    const link = async (containerId: TContainerId, id: TEntity["id"]) =>
        await withGantErrorHandling(async () => {
            const linked = await api.apiLink(id, containerId);
            dispatch(builders.add(linked, containerId));
            return linked;
        }, `Failed to link ${label} (ID: ${id}) to ${containerLabel} (ID: ${containerId}):`);

    const unlink = async (containerId: TContainerId, id: TEntity["id"]) => {
        // Snapshot before dispatching: `remove` drops the id from the
        // container's list, so we need the entity to put it back on failure.
        const snapshot = getEntity?.(id);
        if (snapshot) dispatch(builders.remove(containerId, id));

        try {
            await api.apiUnlink(id, containerId);
            if (!snapshot) dispatch(builders.remove(containerId, id));
        } catch (error) {
            // Re-link on failure. `add` appends, so an item restored this way
            // lands at the end of the container rather than its original
            // index — accepted, since it only shows on the rare failure path.
            if (snapshot) dispatch(builders.add(snapshot, containerId));
            console.error(
                `Failed to unlink ${label} (ID: ${id}) from ${containerLabel} (ID: ${containerId}):`,
                error,
            );
            throw error;
        }
    };

    const allocateTime = async (
        id: TEntity["id"],
        curriculumId: GanttCurriculumId,
        allocatedDuration: number,
    ) => {
        const buildAllocateTime = builders.allocateTime;
        // Optimistic only when the caller can hand back a prior value to
        // restore — see `getAllocatedTime`.
        const previous = getAllocatedTime?.(id);
        const isOptimistic = buildAllocateTime && previous !== undefined;

        if (isOptimistic) {
            dispatch(buildAllocateTime(id, curriculumId, allocatedDuration));
        }

        try {
            await api.apiSetAllocatedTime(id, curriculumId, allocatedDuration);
            if (!isOptimistic && buildAllocateTime) {
                dispatch(
                    buildAllocateTime(id, curriculumId, allocatedDuration),
                );
            }
        } catch (error) {
            if (isOptimistic) {
                dispatch(buildAllocateTime(id, curriculumId, previous));
            }
            console.error(
                `Failed to allocate time to ${label} (ID: ${id}):`,
                error,
            );
            throw error;
        }
    };

    return { create, update, remove, link, unlink, allocateTime } as const;
}
