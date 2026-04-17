import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { ClientApiError } from "@/api-shared/errors";
import { ApiT, BaseGantItem } from "@/api-shared/types/gant/curriculum";

export interface BasicGantLinkOperations<TEntity extends BaseGantItem>
{
    linkItem: (newParentId: string, id: TEntity[ 'id' ]) => Promise<ApiT<TEntity>>;
    unlinkItem: (oldParentId: string, id: TEntity[ 'id' ]) => Promise<void>;
}

export interface BuildGantLinkRoutesProps<TEntity extends BaseGantItem>
{
    dbSet: BasicGantLinkOperations<TEntity>;
}

export interface RouteContext
{
    params: Promise<{ id: string; }>;
}

export function buildGantLinkRoutes<
    TEntity extends BaseGantItem
>({ dbSet }: BuildGantLinkRoutesProps<TEntity>)
{
    async function POST(request: NextRequest, context: RouteContext)
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

            const { newParentId } = JSON.parse(textBody) as { newParentId: string; };
            const linkedItem = await dbSet.linkItem(newParentId, (id as TEntity[ 'id' ]));

            return ApiSuccess(linkedItem);
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

            const textBody = await request.text();
            if (!textBody)
            {
                throw new ClientApiError('Payload cannot be empty.');
            }

            const { oldParentId } = JSON.parse(textBody) as { oldParentId: string; };
            await dbSet.unlinkItem(oldParentId, (id as TEntity[ 'id' ]));

            return ApiSuccess({ unlinked: true, id: id });
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    return {
        POST,
        DELETE
    } as const;
}
