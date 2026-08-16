import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gantt/models";
import { BasicGantOperations } from "@/app/api/gantt/base-collection";

export type BuildGantItemRoutesProps<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
> = {
    dbSet: BasicGantOperations<TEntity, TCreatePayload>;
};

export type RouteContext = {
    params: Promise<{ id: string }>;
};

async function resolveItemId(context: RouteContext): Promise<string> {
    const { id } = await context.params;
    if (!id) {
        throw new ClientApiError(
            "Item identifier (id) is missing from the request parameters.",
        );
    }
    return id;
}

export function buildGantItemRoutes<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
>({ dbSet }: BuildGantItemRoutesProps<TEntity, TCreatePayload>) {
    const GET = withApi(
        async (_request: NextRequest, context: RouteContext) => {
            await requireStaffSession();
            const id = await resolveItemId(context);
            const item = await dbSet.getItem(id as TEntity["id"]);
            return ApiSuccess(item);
        },
    );

    const PATCH = withApi(
        async (request: NextRequest, context: RouteContext) => {
            await requireStaffSession();
            const id = await resolveItemId(context);

            const textBody = await request.text();
            if (!textBody) {
                throw new ClientApiError("Payload cannot be empty.");
            }

            // Strongly typed to Partial<TEntity> to ensure we only update valid frontend properties
            const payload = parseJsonBody<Partial<TEntity>>(textBody);
            if (
                typeof payload !== "object" ||
                payload === null ||
                Array.isArray(payload)
            ) {
                throw new ClientApiError("Payload must be a JSON object.");
            }

            const updatedItem = await dbSet.updateItem(
                id as TEntity["id"],
                payload,
            );
            return ApiSuccess(updatedItem);
        },
    );

    const DELETE = withApi(
        async (_request: NextRequest, context: RouteContext) => {
            await requireStaffSession();
            const id = await resolveItemId(context);
            await dbSet.deleteItem(id as TEntity["id"]);
            return ApiSuccess({ deleted: true, id: id });
        },
    );

    return {
        GET,
        PATCH,
        DELETE,
    } as const;
}
