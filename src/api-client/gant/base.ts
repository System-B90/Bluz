import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { Dayjs } from "dayjs";

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

export interface ClientGantApiBuilderProps<TEntity extends BaseGantItem, ApiT, TCreatePayload = Omit<TEntity, 'id'>>
{
    apiBaseUrl: string;
    dateFixup: DateFixup<TEntity>;
}

export interface BasicGantApi<TEntity extends BaseGantItem, ApiT, TCreatePayload = Omit<TEntity, 'id'>>
{
    readonly apiList: (options?: ClientApiProps) => Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>;
    readonly apiGet: (id: TEntity[ 'id' ], options?: ClientApiProps) => Promise<ApiT>;
    readonly apiCreate: (payload: TCreatePayload, options?: ClientApiProps) => Promise<TEntity & BaseDocument>;
    readonly apiUpdate: (updates: Partial<TEntity> & { id: TEntity[ 'id' ]; }, options?: ClientApiProps) => Promise<TEntity & BaseDocument>;
    readonly apiDelete: (id: TEntity[ 'id' ], options?: ClientApiProps) => Promise<void>;
    readonly apiGetMany: (ids: Array<TEntity[ 'id' ]>, options?: ClientApiProps) => Promise<Record<TEntity[ 'id' ], TEntity & BaseDocument>>;
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

    // Helper to safely construct URLs without double slashes
    const buildUrl = (path: string = "") => `${apiBaseUrl.replace(/\/$/, '')}${path ? `/${path}` : ''}`;

    async function apiList(options?: ClientApiProps): Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>
    {
        return await safeApiFetcher<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>(buildUrl(), options);
    }

    async function apiGet(id: TEntity[ 'id' ], options?: ClientApiProps): Promise<ApiT>
    {
        const rawData = await safeApiFetcher(buildUrl(id), options);
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
        // Destructure to isolate the ID and prevent it from leaking into the PATCH body
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
        await safeApiFetcher(buildUrl(id), {
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

    return {
        apiList,
        apiGet,
        apiCreate,
        apiUpdate,
        apiDelete,
        apiGetMany,
    } as const;
}
