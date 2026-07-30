import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiT } from "@/api-shared/types/gantt/api-layer";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

export type BasicGantOperations<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
> = {
    listItems: (
        withParents?: boolean,
    ) => Promise<
        | Record<TEntity["id"], { title: TEntity["title"] }>
        | Record<TEntity["id"], TEntity["title"]>
    >;
    getMultipleItems: (ids: Array<string>) => Promise<Array<TEntity>>;
    getItem: (id: TEntity["id"]) => Promise<any>;
    createNewItem: (
        payload: TCreatePayload,
    ) => Promise<ApiT<TEntity> | TEntity>; // TODO: This should always be ApiT<TEntity>
    updateItem: (
        id: TEntity["id"],
        updates: Partial<TEntity>,
    ) => Promise<TEntity>;
    deleteItem: (id: TEntity["id"]) => Promise<void>;
};

/** Accepts the usual truthy spellings for a boolean query flag. */
function parseBooleanParam(raw: null | string): boolean {
    if (raw === null) return false;
    const value = raw.trim().toLowerCase();
    return value === "" || value === "1" || value === "true" || value === "yes";
}

export type BuildGantCollectionRoutesProps<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
> = {
    dbSet: BasicGantOperations<TEntity, TCreatePayload>;
};

export function buildGantCollectionRoutes<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
>({ dbSet }: BuildGantCollectionRoutesProps<TEntity, TCreatePayload>) {
    const GET = withApi(async (request: NextRequest) => {
        await requireStaffSession();
        const requestedIds = request.nextUrl.searchParams.get("ids");
        // `?withParents=1` opts the label map into `{ title, <parentKey> }`
        // values. Off by default — the flat `Record<id, title>` shape is the
        // published contract and changing it unconditionally would break every
        // existing caller. See #310.
        const withParents = parseBooleanParam(
            request.nextUrl.searchParams.get("withParents"),
        );
        let items: Record<TEntity["id"], unknown>;

        if (requestedIds === null) {
            items = await dbSet.listItems(withParents);
        } else {
            const itemArray = await dbSet.getMultipleItems(
                requestedIds.split(","),
            );
            items = itemArray.reduce(
                (acc, doc) => {
                    acc[doc.id as TEntity["id"]] = doc;
                    return acc;
                },
                {} as Record<TEntity["id"], TEntity>,
            );
        }
        return ApiSuccess(items);
    });

    const POST = withApi(async (request: NextRequest) => {
        await requireStaffSession();
        // Strongly typed as TCreatePayload, allowing relational IDs to flow into the DB layer
        const payload = (await request.json()) as TCreatePayload;

        // Minimal, on-demand shape check: reject non-object bodies at the
        // boundary with a 400 instead of letting them hit the DB and surface as
        // a raw error (#162). Field/enum validation stays in the DB layer.
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            throw new ClientApiError("Request body must be a JSON object.");
        }

        // The DB layer handles extracting the foreign keys and returning the clean TEntity
        const newItem = await dbSet.createNewItem(payload);
        return ApiSuccess(newItem);
    });

    return {
        GET,
        POST,
    } as const;
}
