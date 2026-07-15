import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiT } from "@/api-shared/types/gantt/api-layer";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

export type BasicGantLinkOperations<TEntity extends BaseGantItem> = {
    linkItem: (
        newParentId: string,
        id: TEntity["id"],
    ) => Promise<ApiT<TEntity>>;
    unlinkItem: (oldParentId: string, id: TEntity["id"]) => Promise<void>;
};

export type BuildGantLinkRoutesProps<TEntity extends BaseGantItem> = {
    dbSet: BasicGantLinkOperations<TEntity>;
};

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export function buildGantLinkRoutes<TEntity extends BaseGantItem>({
    dbSet,
}: BuildGantLinkRoutesProps<TEntity>) {
    const POST = withApi(async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) {
            throw new ClientApiError(
                "Item identifier (id) is missing from the request parameters.",
            );
        }

        const textBody = await request.text();
        if (!textBody) {
            throw new ClientApiError("Payload cannot be empty.");
        }

        const { newParentId } = JSON.parse(textBody) as {
            newParentId: string;
        };
        const linkedItem = await dbSet.linkItem(
            newParentId,
            id as TEntity["id"],
        );

        return ApiSuccess(linkedItem);
    });

    const DELETE = withApi(async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) {
            throw new ClientApiError(
                "Item identifier (id) is missing from the request parameters.",
            );
        }

        const textBody = await request.text();
        if (!textBody) {
            throw new ClientApiError("Payload cannot be empty.");
        }

        const { oldParentId } = JSON.parse(textBody) as {
            oldParentId: string;
        };
        await dbSet.unlinkItem(oldParentId, id as TEntity["id"]);

        return ApiSuccess({ unlinked: true, id: id });
    });

    return {
        POST,
        DELETE,
    } as const;
}
