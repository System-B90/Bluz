import { ApiSuccess, catchHandler } from "@/api-server/common";
import { BaseDbDocument } from "@/api-server/curriculum/db-base";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { NextRequest } from "next/server";

export interface BasicGantOperations<TEntity extends BaseGantItem, TCreatePayload = Omit<TEntity, 'id'>>
{
    listItems: () => Promise<Record<TEntity[ 'id' ], TEntity[ 'title' ]>>;
    getMultipleItems: (ids: string[]) => Promise<TEntity[]>;
    getItem: (id: TEntity[ 'id' ]) => Promise<TEntity & BaseDbDocument>;
    createNewItem: (payload: TCreatePayload) => Promise<TEntity>;
    updateItem: (id: TEntity[ 'id' ], updates: Partial<TEntity>) => Promise<TEntity>;
    deleteItem: (id: TEntity[ 'id' ]) => Promise<void>;
}

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
