import { Dayjs } from "dayjs";

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { ApiT, RawBaseDocument } from "@/api-shared/types/gantt/api-layer";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

export type BaseDocument = {
    createdAt: Dayjs;
    updatedAt: Dayjs;
};

export type { RawBaseDocument };

export type DateFixup<T extends RawBaseDocument> = <U extends T>(
    rawItem: unknown,
) => Exclude<U, RawBaseDocument> & BaseDocument;

export function baseDocumentFixup<T extends K & RawBaseDocument, K extends any>(
    doc: T,
): T & BaseDocument;
export function baseDocumentFixup<
    T extends (K & RawBaseDocument) | null,
    K extends any,
>(doc: T): null | (T & BaseDocument) {
    if (doc === null) return null;
    inplaceDateFixup(doc, ["updatedAt", "createdAt"]);
    return doc as T & BaseDocument;
}

export type ClientGantApiBuilderProps<
    TEntity extends BaseGantItem,
    _TCreatePayload = Omit<TEntity, "id">,
> = {
    apiBaseUrl: string;
    dateFixup: DateFixup<TEntity & RawBaseDocument>;
};

/**
 * One entry of `apiListWithParents`: the label plus the entity's parent key
 * (`syllabusId` on modules, `moduleId` on events, `curriculumId` on
 * syllabuses/weeks/days), `null` when the child is unlinked. Root entities
 * (curriculums) carry no parent key at all.
 */
export type ListEntryWithParent<TEntity extends BaseGantItem> = {
    title: TEntity["title"];
} & Record<string, null | string>;

export type BasicGantApi<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
> = {
    readonly apiList: (
        options?: ClientApiProps,
    ) => Promise<Record<TEntity["id"], TEntity["title"]>>;
    /**
     * Same listing as `apiList`, but each value carries the parent id. Use
     * when you need child → parent without fetching each item. See #310.
     */
    readonly apiListWithParents: (
        options?: ClientApiProps,
    ) => Promise<Record<TEntity["id"], ListEntryWithParent<TEntity>>>;
    readonly apiGet: (
        id: TEntity["id"],
        options?: ClientApiProps,
    ) => Promise<ApiT<TEntity & BaseDocument>>;
    readonly apiCreate: (
        payload: TCreatePayload,
        options?: ClientApiProps,
    ) => Promise<TEntity & BaseDocument>;
    readonly apiUpdate: (
        updates: Partial<TEntity> & { id: TEntity["id"] },
        options?: ClientApiProps,
    ) => Promise<TEntity & BaseDocument>;
    readonly apiDelete: (
        id: TEntity["id"],
        options?: ClientApiProps,
    ) => Promise<void>;
    readonly apiGetMany: (
        ids: Array<TEntity["id"]>,
        options?: ClientApiProps,
    ) => Promise<Record<TEntity["id"], TEntity & BaseDocument>>;
    readonly apiLink: (
        itemId: TEntity["id"],
        newParentId: BaseGantItem["id"],
        options?: ClientApiProps,
    ) => Promise<TEntity & BaseDocument>;
    readonly apiUnlink: (
        itemId: TEntity["id"],
        oldParentId: BaseGantItem["id"],
        options?: ClientApiProps,
    ) => Promise<void>;
    readonly apiSetAllocatedTime: (
        itemId: TEntity["id"],
        containerId: BaseGantItem["id"],
        allocatedTime: number,
        options?: ClientApiProps,
    ) => Promise<void>;
    readonly apiGetAllocatedTime: (
        itemId: TEntity["id"],
        containerId: BaseGantItem["id"],
        options?: ClientApiProps,
    ) => Promise<number>;
};

export function clientGantApiBuilder<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
>({
    apiBaseUrl,
    dateFixup,
}: ClientGantApiBuilderProps<TEntity, TCreatePayload>): BasicGantApi<
    TEntity,
    TCreatePayload
> {
    type TDocument = TEntity & BaseDocument;

    const buildUrl = (path: string = "") =>
        `${apiBaseUrl.replace(/\/$/, "")}${path ? `/${path}` : ""}`;
    const buildItemUrl = (id: TEntity["id"], path: string = "") =>
        `${apiBaseUrl.replace(/\/$/, "")}/${id}${path ? `/${path}` : ""}`;

    async function apiList(
        options?: ClientApiProps,
    ): Promise<Record<TEntity["id"], TEntity["title"]>> {
        return await safeApiFetcher<Record<TEntity["id"], TEntity["title"]>>(
            buildUrl(),
            options,
        );
    }

    async function apiListWithParents(
        options?: ClientApiProps,
    ): Promise<Record<TEntity["id"], ListEntryWithParent<TEntity>>> {
        return await safeApiFetcher<
            Record<TEntity["id"], ListEntryWithParent<TEntity>>
        >(`${buildUrl()}?withParents=1`, options);
    }

    async function apiGet(
        id: TEntity["id"],
        options?: ClientApiProps,
    ): Promise<ApiT<TEntity & BaseDocument>> {
        const rawData = await safeApiFetcher<ApiT<TEntity>>(
            buildItemUrl(id),
            options,
        );
        return dateFixup(rawData);
    }

    async function apiCreate(
        payload: TCreatePayload,
        options?: ClientApiProps,
    ): Promise<TDocument> {
        const rawData = await safeApiFetcher<TEntity>(buildUrl(), {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        });
        return dateFixup(rawData);
    }

    async function apiUpdate(
        updates: Partial<TEntity> & { id: TEntity["id"] },
        options?: ClientApiProps,
    ): Promise<TDocument> {
        const { id, ...patchPayload } = updates;

        const rawData = await safeApiFetcher<TEntity>(buildUrl(id), {
            ...options,
            method: "PATCH",
            body: JSON.stringify(patchPayload),
        });
        return dateFixup(rawData);
    }

    async function apiDelete(
        id: TEntity["id"],
        options?: ClientApiProps,
    ): Promise<void> {
        await safeApiFetcher<void>(buildItemUrl(id), {
            ...options,
            method: "DELETE",
        });
    }

    async function apiGetMany(
        ids: Array<TEntity["id"]>,
        options?: ClientApiProps,
    ): Promise<Record<TEntity["id"], TDocument>> {
        if (!ids.length) return {} as Record<TEntity["id"], TDocument>;

        const baseUrl = `${window.location.origin}${buildUrl()}`;
        const fetchUrl = new URL(baseUrl);
        fetchUrl.searchParams.set("ids", ids.join(","));

        const rawData = await safeApiFetcher<Record<TEntity["id"], unknown>>(
            fetchUrl.toString(),
            options,
        );

        return Object.entries(rawData).reduce(
            (acc, [id, item]) => {
                acc[id as TEntity["id"]] = dateFixup(item);
                return acc;
            },
            {} as Record<TEntity["id"], TDocument>,
        );
    }

    async function apiLink(
        itemId: TEntity["id"],
        newParentId: BaseGantItem["id"],
        options?: ClientApiProps,
    ): Promise<TDocument> {
        const rawData = await safeApiFetcher<TEntity>(
            buildItemUrl(itemId, "link"),
            {
                ...options,
                method: "POST",
                body: JSON.stringify({ newParentId }),
            },
        );
        return dateFixup(rawData);
    }

    async function apiUnlink(
        itemId: TEntity["id"],
        oldParentId: BaseGantItem["id"],
        options?: ClientApiProps,
    ): Promise<void> {
        await safeApiFetcher<void>(buildItemUrl(itemId, "link"), {
            ...options,
            method: "DELETE",
            body: JSON.stringify({ oldParentId }),
        });
    }

    async function apiSetAllocatedTime(
        itemId: TEntity["id"],
        containerId: BaseGantItem["id"],
        allocatedTime: number,
        options?: ClientApiProps,
    ): Promise<void> {
        await safeApiFetcher<void>(buildItemUrl(itemId, "allocate-time"), {
            ...options,
            method: "POST",
            body: JSON.stringify({ containerId, duration: allocatedTime }),
        });
    }

    async function apiGetAllocatedTime(
        itemId: TEntity["id"],
        containerId: BaseGantItem["id"],
        options?: ClientApiProps,
    ): Promise<number> {
        const baseUrl = `${window.location.origin}${buildItemUrl(itemId, "allocate-time")}`;
        const fetchUrl = new URL(baseUrl);
        // The route reads `containerId`; anything else is a 400.
        fetchUrl.searchParams.set("containerId", containerId);

        return await safeApiFetcher<number>(fetchUrl.toString(), options);
    }

    return {
        apiList,
        apiListWithParents,
        apiGet,
        apiCreate,
        apiUpdate,
        apiDelete,
        apiGetMany,
        apiLink,
        apiUnlink,
        apiGetAllocatedTime,
        apiSetAllocatedTime,
    } as const;
}
