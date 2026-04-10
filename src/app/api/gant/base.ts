import { ApiSuccess, catchHandler } from "@/api-server/common";
import { BasicGantOperations } from "@/api-server/curriculum/db-base";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { NextRequest } from "next/server";

export interface BuildGantCollectionRoutesProps<T extends BaseGantItem>
{
    dbSet: BasicGantOperations<T>;
}
export function buildGantCollectionRoutes<T extends BaseGantItem>({ dbSet }: BuildGantCollectionRoutesProps<T>)
{
    async function GET(request: NextRequest)
    {
        try
        {
            const requestedIds = request.nextUrl.searchParams.get('ids');
            let items: Record<T[ "id" ], T[ "title" ] | T>;
            if (requestedIds === null)
            {
                items = await dbSet.listItems();
            }
            else
            {
                const itemArray = await dbSet.getMultipleItems(requestedIds.split(','));
                items = itemArray.reduce((acc, doc) =>
                {
                    acc[ doc.id as T[ 'id' ] ] = doc;
                    return acc;
                }, {} as Record<T[ 'id' ], T>);
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
            const payload = await request.json();
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
export interface BuildGantItemRoutesProps<T extends BaseGantItem>
{
    dbSet: BasicGantOperations<T>;
}

// Explicitly extracted for clarity and Next.js 15+ Promise-based params compatibility
export interface RouteContext
{
    params: Promise<{ slug: string; }>;
}

export function buildGantItemRoutes<T extends BaseGantItem>({ dbSet }: BuildGantItemRoutesProps<T>)
{

    async function GET(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { slug } = await context.params;
            if (!slug)
            {
                throw new ClientApiError('Item identifier (slug) is missing from the request parameters.');
            }

            const item = await dbSet.getItem(slug as T[ 'id' ]);
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
            const { slug } = await context.params;
            if (!slug)
            {
                throw new ClientApiError('Item identifier (slug) is missing from the request parameters.');
            }

            // Safe parsing check to prevent 500s on empty bodies
            const textBody = await request.text();
            if (!textBody)
            {
                throw new ClientApiError('Payload cannot be empty.');
            }

            // Strongly typing the payload to prevent DB overwrite anomalies
            const payload = JSON.parse(textBody) as Parameters<typeof dbSet.updateItem>[ 1 ];

            const updatedItem = await dbSet.updateItem(slug as T[ 'id' ], payload);
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
            const { slug } = await context.params;
            if (!slug)
            {
                throw new ClientApiError('Item identifier (slug) is missing from the request parameters.');
            }

            await dbSet.deleteItem(slug as T[ 'id' ]);
            return ApiSuccess({ deleted: true, id: slug });
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
