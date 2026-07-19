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
}: MakeEntityActionsProps<TEntity, TContainerId, TCreatePayload>) {
    const create = async (payload: TCreatePayload, containerId: TContainerId) =>
        await withGantErrorHandling(async () => {
            const entity = await api.apiCreate(payload);
            dispatch(builders.add(entity, containerId));
            return entity;
        }, `Failed to create ${label}:`);

    const update = async (id: TEntity["id"], updates: Partial<TEntity>) =>
        await withGantErrorHandling(async () => {
            const updated = await api.apiUpdate({ id, ...updates });
            dispatch(builders.update(id, updated));
            return updated;
        }, `Failed to update ${label} (ID: ${id}):`);

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

    const unlink = async (containerId: TContainerId, id: TEntity["id"]) =>
        await withGantErrorHandling(async () => {
            await api.apiUnlink(id, containerId);
            dispatch(builders.remove(containerId, id));
        }, `Failed to unlink ${label} (ID: ${id}) from ${containerLabel} (ID: ${containerId}):`);

    const allocateTime = async (
        id: TEntity["id"],
        curriculumId: GanttCurriculumId,
        allocatedDuration: number,
    ) =>
        await withGantErrorHandling(async () => {
            await api.apiSetAllocatedTime(id, curriculumId, allocatedDuration);
            const buildAllocateTime = builders.allocateTime;
            if (buildAllocateTime) {
                dispatch(buildAllocateTime(id, curriculumId, allocatedDuration));
            }
        }, `Failed to allocate time to ${label} (ID: ${id}):`);

    return { create, update, remove, link, unlink, allocateTime } as const;
}
