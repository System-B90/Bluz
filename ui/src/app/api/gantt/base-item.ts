import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gantt/curriculum";
import { BasicGantOperations } from "@/app/api/gantt/base-collection";

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

            const item = await dbSet.getItem((id as TEntity[ 'id' ]));
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

            const updatedItem = await dbSet.updateItem((id as TEntity[ 'id' ]), payload);
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

            await dbSet.deleteItem((id as TEntity[ 'id' ]));
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
