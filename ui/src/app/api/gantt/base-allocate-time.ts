/**
 * Name: route-builder.ts
 * Purpose: RESTful Route factory for contextual event durations
 * Created: 2026-04-13
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    BaseGantItem,
    GanttCurriculumId,
    GanttEventId,
} from "@/api-shared/types/gantt/models";

export type BasicGantAllocateTimeOperations<_TEntity extends BaseGantItem> = {
    getAllocatedTime: (
        eventId: GanttEventId,
        containerId: GanttCurriculumId,
    ) => Promise<number>;
    setAllocatedTime: (
        eventId: GanttEventId,
        containerId: GanttCurriculumId,
        duration: number,
    ) => Promise<void>;
};

export type BuildGantAllocateTimeRoutesProps<TEntity extends BaseGantItem> = {
    dbSet: BasicGantAllocateTimeOperations<TEntity>;
};

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export function buildGantAllocateTimeRoutes<TEntity extends BaseGantItem>({
    dbSet,
}: BuildGantAllocateTimeRoutesProps<TEntity>) {
    const GET = withApi(async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const containerId = searchParams.get("containerId");

        if (!id || !containerId) {
            throw new ClientApiError(
                "Both event id and containerId are required.",
            );
        }

        const duration = await dbSet.getAllocatedTime(
            id as GanttEventId,
            containerId,
        );

        return ApiSuccess(duration);
    });

    const POST = withApi(
        async (request: NextRequest, context: RouteContext) => {
            await requireStaffSession();
            const { id } = await context.params;
            if (!id) {
                throw new ClientApiError("Item identifier (id) is missing.");
            }

            const body =
                await requireJsonObjectBody<Record<string, unknown>>(request);
            const { containerId, duration } = body as {
                containerId: BaseGantItem["id"];
                duration: number;
            };

            if (!containerId || typeof duration !== "number") {
                throw new ClientApiError(
                    "Invalid payload: containerId and duration (number) are required.",
                );
            }

            await dbSet.setAllocatedTime(
                id as GanttEventId,
                containerId,
                duration,
            );

            return ApiSuccess({ success: true });
        },
    );

    return {
        GET,
        POST,
    } as const;
}
