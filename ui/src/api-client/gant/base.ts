import { Dayjs } from "dayjs";

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";

export type BaseDocument = {
    createdAt: Dayjs;
    updatedAt: Dayjs;
};

export type RawBaseDocument = {
    createdAt: string;
    updatedAt: string;
};

export type DateFixup<TEntity extends BaseGantItem> = (rawItem: unknown) => TEntity & BaseDocument;

export function baseDocumentFixup<T extends RawBaseDocument | null>(doc: T): T | null
{
    if (!doc) return null;
    inplaceDateFixup(doc, [ 'updatedAt', 'createdAt' ]);
    return doc;
}

export interface ClientGantApiBuilderProps<
    TEntity extends BaseGantItem,
    ApiT,
    TCreatePayload = Omit<TEntity, 'id'>,
>
{
    apiBaseUrl: string;
    dateFixup: DateFixup<TEntity>;
}

export interface BasicGantApi<
    TEntity extends BaseGantItem,
    ApiT,
    TCreatePayload = Omit<TEntity, 'id'>,
>
{
    readonly apiList: (options?: ClientApiProps) => Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>;
    readonly apiGet: (id: TEntity[ 'id' ], options?: ClientApiProps) => Promise<ApiT>;
    readonly apiCreate: (payload: TCreatePayload, options?: ClientApiProps) => Promise<TEntity & BaseDocument>;
    readonly apiUpdate: (updates: Partial<TEntity> & { id: TEntity[ 'id' ]; }, options?: ClientApiProps) => Promise<TEntity & BaseDocument>;
    readonly apiDelete: (id: TEntity[ 'id' ], options?: ClientApiProps) => Promise<void>;
    readonly apiGetMany: (ids: Array<TEntity[ 'id' ]>, options?: ClientApiProps) => Promise<Record<TEntity[ 'id' ], TEntity & BaseDocument>>;
    readonly apiLink: (itemId: TEntity[ 'id' ], newParentId: BaseGantItem[ 'id' ], options?: ClientApiProps) => Promise<TEntity & BaseDocument>;
    readonly apiUnlink: (itemId: TEntity[ 'id' ], oldParentId: BaseGantItem[ 'id' ], options?: ClientApiProps) => Promise<void>;
    readonly apiSetAllocatedTime: (itemId: TEntity[ 'id' ], containerId: BaseGantItem[ 'id' ], allocatedTime: number, options?: ClientApiProps) => Promise<void>;
    readonly apiGetAllocatedTime: (itemId: TEntity[ 'id' ], containerId: BaseGantItem[ 'id' ], options?: ClientApiProps) => Promise<number>;
}

export function clientGantApiBuilder<
    TEntity extends BaseGantItem,
    ApiT,
    TCreatePayload = Omit<TEntity, 'id'>,
>({
    apiBaseUrl,
    dateFixup
}: ClientGantApiBuilderProps<TEntity, ApiT, TCreatePayload>): BasicGantApi<TEntity, ApiT, TCreatePayload>
{
    type TDocument = TEntity & BaseDocument;

    const buildUrl = (path: string = "") => `${apiBaseUrl.replace(/\/$/, '')}${path ? `/${path}` : ''}`;
    const buildItemUrl = (id: TEntity[ 'id' ], path: string = "") => `${apiBaseUrl.replace(/\/$/, '')}/${id}${path ? `/${path}` : ''}`;

    async function apiList(options?: ClientApiProps): Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>
    {
        return await safeApiFetcher<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>(buildUrl(), options);
    }

    async function apiGet(id: TEntity[ 'id' ], options?: ClientApiProps): Promise<ApiT>
    {
        const rawData = await safeApiFetcher(buildItemUrl(id), options);
        return dateFixup(rawData) as ApiT;
    }

    async function apiCreate(payload: TCreatePayload, options?: ClientApiProps): Promise<TDocument>
    {
        const rawData = await safeApiFetcher(buildUrl(), {
            ...options,
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return dateFixup(rawData);
    }

    async function apiUpdate(updates: Partial<TEntity> & { id: TEntity[ 'id' ]; }, options?: ClientApiProps): Promise<TDocument>
    {
        const { id, ...patchPayload } = updates;

        const rawData = await safeApiFetcher(buildUrl(id), {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(patchPayload),
        });
        return dateFixup(rawData);
    }

    async function apiDelete(id: TEntity[ 'id' ], options?: ClientApiProps): Promise<void>
    {
        await safeApiFetcher(buildItemUrl(id), {
            ...options,
            method: 'DELETE',
        });
    }

    async function apiGetMany(ids: Array<TEntity[ 'id' ]>, options?: ClientApiProps): Promise<Record<TEntity[ 'id' ], TDocument>>
    {
        if (!ids.length) return {} as Record<TEntity[ 'id' ], TDocument>;

        const baseUrl = `${window.location.origin}${buildUrl()}`;
        const fetchUrl = new URL(baseUrl);
        fetchUrl.searchParams.set('ids', ids.join(','));

        const rawData = await safeApiFetcher<Record<TEntity[ 'id' ], unknown>>(fetchUrl.toString(), options);

        return Object.entries(rawData).reduce((acc, [ id, item ]) =>
        {
            acc[ id as TEntity[ 'id' ] ] = dateFixup(item);
            return acc;
        }, {} as Record<TEntity[ 'id' ], TDocument>);
    }

    async function apiLink(itemId: TEntity[ 'id' ], newParentId: BaseGantItem[ 'id' ], options?: ClientApiProps): Promise<TDocument>
    {
        const rawData = await safeApiFetcher(buildItemUrl(itemId, 'link'), {
            ...options,
            method: 'POST',
            body: JSON.stringify({ newParentId }),
        });
        return dateFixup(rawData);
    }

    async function apiUnlink(itemId: TEntity[ 'id' ], oldParentId: BaseGantItem[ 'id' ], options?: ClientApiProps): Promise<void>
    {
        await safeApiFetcher(buildItemUrl(itemId, 'link'), {
            ...options,
            method: 'DELETE',
            body: JSON.stringify({ oldParentId }),
        });
    }

    async function apiSetAllocatedTime(itemId: TEntity[ 'id' ], containerId: BaseGantItem[ 'id' ], allocatedTime: number, options?: ClientApiProps): Promise<void>
    {
        await safeApiFetcher<void>(buildItemUrl(itemId, 'allocate-time'), {
            ...options,
            method: 'POST',
            body: JSON.stringify({ containerId, duration: allocatedTime }),
        });
    }

    async function apiGetAllocatedTime(itemId: TEntity[ 'id' ], containerId: BaseGantItem[ 'id' ], options?: ClientApiProps): Promise<number>
    {
        const baseUrl = `${window.location.origin}${buildItemUrl(itemId, 'allocate-time')}`;
        const fetchUrl = new URL(baseUrl);
        fetchUrl.searchParams.set('curriculumId', containerId);

        return await safeApiFetcher<number>(fetchUrl.toString(), options);
    }

    return {
        apiList,
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
