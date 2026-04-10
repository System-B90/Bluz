import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { ProviderApiCreate, ProviderApiDelete, ProviderApiGet, ProviderApiGetMany, ProviderApiList, ProviderApiUpdate } from "@/components/gant/providers/base/types";
import { Dayjs } from "dayjs";

export type BaseDocument = {
    createdAt: Dayjs;
    updatedAt: Dayjs;
};

// Represents the raw JSON response before Dayjs conversion
export type RawBaseDocument = {
    createdAt: string;
    updatedAt: string;
};


// dateFixup now explicitly takes the raw data and returns the heavily typed Dayjs document
export type DateFixup<T extends BaseGantItem> = (rawItem: unknown) => T & BaseDocument;

export function baseDocumentFixup<T extends RawBaseDocument | null>(doc: T): T | null
{
    if (!doc) { return null; }
    inplaceDateFixup(doc, [ 'updatedAt', 'createdAt' ]);
    return doc;
}

export interface ClientGantApiBuilderProps<T extends BaseGantItem>
{
    apiBaseUrl: string;
    dateFixup: DateFixup<T>;
}

export interface BasicGantApi<T extends BaseGantItem>
{
    readonly apiUpdate: ProviderApiUpdate<T>;
    readonly apiList: ProviderApiList<T>;
    readonly apiCreate: ProviderApiCreate<T>;
    readonly apiDelete: ProviderApiDelete<T>;
    readonly apiGet: ProviderApiGet<T>;
    readonly apiGetMany: ProviderApiGetMany<T>;
}

export function clientGantApiBuilder<T extends BaseGantItem>({ apiBaseUrl, dateFixup }: ClientGantApiBuilderProps<T>): BasicGantApi<T>
{

    type TDocument = T & BaseDocument;

    async function apiList(options?: ClientApiProps): Promise<Record<T[ 'id' ], T[ 'title' ]>>
    {
        return await safeApiFetcher<Record<T[ 'id' ], T[ 'title' ]>>(`${apiBaseUrl}`, options);
    }

    async function apiGet(id: T[ 'id' ], options?: ClientApiProps): Promise<TDocument>
    {
        const rawData = await safeApiFetcher(`${apiBaseUrl}/${id}`, options);
        return dateFixup(rawData);
    }

    async function apiCreate(newItem: Omit<T, 'id'>, options?: ClientApiProps): Promise<TDocument>
    {
        const rawData = await safeApiFetcher(`${apiBaseUrl}`, {
            ...options,
            method: 'POST',
            body: JSON.stringify(newItem),
        });
        return dateFixup(rawData);
    }

    async function apiUpdate(updates: Partial<T> & { id: T[ 'id' ]; }, options?: ClientApiProps): Promise<TDocument>
    {
        // Destructure to isolate the ID and prevent it from leaking into the PATCH body
        const { id, ...patchPayload } = updates;

        const rawData = await safeApiFetcher(`${apiBaseUrl}/${id}`, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(patchPayload),
        });
        return dateFixup(rawData);
    }

    async function apiDelete(id: T[ 'id' ], options?: ClientApiProps): Promise<void>
    {
        await safeApiFetcher(`${apiBaseUrl}/${id}`, {
            ...options,
            method: 'DELETE',
        });
    }

    async function apiGetMany(ids: Array<T[ 'id' ]>, options?: ClientApiProps): Promise<Record<T[ 'id' ], TDocument>>
    {
        const baseUrl = `${window.location.origin}${apiBaseUrl}`;
        const fetchUrl = new URL(baseUrl);
        fetchUrl.searchParams.set('ids', ids.join(','));
        const rawData = await safeApiFetcher<Record<T[ 'id' ], unknown>>(fetchUrl.toString(), options);
        return Object.entries(rawData).reduce((acc, [ id, item ]) =>
        {
            acc[ id as T[ 'id' ] ] = dateFixup(item);
            return acc;
        }, {} as Record<T[ 'id' ], TDocument>);
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
