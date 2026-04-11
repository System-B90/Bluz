import { ApiSuccess, catchHandler } from "@/api-server/common";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { NextRequest } from "next/server";

// --- 1. Updated Database Operations Contract ---
// We add TCreatePayload so the DB layer knows it expects foreign keys during POST
export interface BasicGantOperations<TEntity extends BaseGantItem, TCreatePayload = Omit<TEntity, 'id'>>
{
    listItems: () => Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>;
    getMultipleItems: (ids: string[]) => Promise<TEntity[]>;
    getItem: (id: TEntity[ 'id' ]) => Promise<TEntity>;
    createNewItem: (payload: TCreatePayload) => Promise<TEntity>;
    updateItem: (id: TEntity[ 'id' ], updates: Partial<TEntity>) => Promise<TEntity>;
    deleteItem: (id: TEntity[ 'id' ]) => Promise<void>;
}


// --- 2. Collection Routes Builder (GET list, POST create) ---

export interface BuildGantCollectionRoutesProps<TEntity extends BaseGantItem, TCreatePayload = Omit<TEntity, 'id'>>
{
    dbSet: BasicGantOperations<TEntity, TCreatePayload>;
}

export function buildGantCollectionRoutes<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, 'id'>
>({ dbSet }: BuildGantCollectionRoutesProps<TEntity, TCreatePayload>)
{

    async function GET(request: NextRequest)
    {
        try
        {
            const requestedIds = request.nextUrl.searchParams.get('ids');
            let items: Record<TEntity[ "id" ], TEntity[ "title" ] | TEntity>;

            if (requestedIds === null)
            {
                items = await dbSet.listItems();
            } else
            {
                const itemArray = await dbSet.getMultipleItems(requestedIds.split(','));
                items = itemArray.reduce((acc, doc) =>
                {
                    acc[ doc.id as TEntity[ 'id' ] ] = doc;
                    return acc;
                }, {} as Record<TEntity[ 'id' ], TEntity>);
            }
            return ApiSuccess(items);
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    async function POST(request: NextRequest)
    {
        try
        {
            // Strongly typed as TCreatePayload, allowing relational IDs to flow into the DB layer
            const payload = (await request.json()) as TCreatePayload;

            // The DB layer handles extracting the foreign keys and returning the clean TEntity
            const newItem = await dbSet.createNewItem(payload);
            return ApiSuccess(newItem);
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    return {
        GET,
        POST,
    } as const;
}


// --- 3. Single Item Routes Builder (GET single, PATCH, DELETE) ---

export interface BuildGantItemRoutesProps<TEntity extends BaseGantItem, TCreatePayload = Omit<TEntity, 'id'>>
{
    dbSet: BasicGantOperations<TEntity, TCreatePayload>;
}

export interface RouteContext
{
    params: Promise<{ id: string; }>;
}

export function buildGantItemRoutes<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, 'id'>
>({ dbSet }: BuildGantItemRoutesProps<TEntity, TCreatePayload>)
{

    async function GET(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { id } = await context.params;
            if (!id)
            {
                throw new ClientApiError('Item identifier (id) is missing from the request parameters.');
            }

            const item = await dbSet.getItem(id as TEntity[ 'id' ]);
            return ApiSuccess(item);
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    async function PATCH(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { id } = await context.params;
            if (!id)
            {
                throw new ClientApiError('Item identifier (id) is missing from the request parameters.');
            }

            const textBody = await request.text();
            if (!textBody)
            {
                throw new ClientApiError('Payload cannot be empty.');
            }

            // Strongly typed to Partial<TEntity> to ensure we only update valid frontend properties
            const payload = JSON.parse(textBody) as Partial<TEntity>;

            const updatedItem = await dbSet.updateItem(id as TEntity[ 'id' ], payload);
            return ApiSuccess(updatedItem);
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    async function DELETE(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { id } = await context.params;
            if (!id)
            {
                throw new ClientApiError('Item identifier (id) is missing from the request parameters.');
            }

            await dbSet.deleteItem(id as TEntity[ 'id' ]);
            return ApiSuccess({ deleted: true, id: id });
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    return {
        GET,
        PATCH,
        DELETE
    } as const;
}
