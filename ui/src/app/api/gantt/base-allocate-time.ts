/**
 * Name: route-builder.ts
 * Purpose: RESTful Route factory for contextual event durations
 * Created: 2026-04-13
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem, GanttCurriculumId, GanttEventId } from "@/api-shared/types/gantt/models/curriculum";

export interface BasicGantAllocateTimeOperations<_TEntity extends BaseGantItem>
{
    getAllocatedTime: (eventId: GanttEventId, containerId: GanttCurriculumId) => Promise<number>;
    setAllocatedTime: (
        eventId: GanttEventId,
        containerId: GanttCurriculumId,
        duration: number
    ) => Promise<void>;
}

export interface BuildGantAllocateTimeRoutesProps<TEntity extends BaseGantItem>
{
    dbSet: BasicGantAllocateTimeOperations<TEntity>;
}

export interface RouteContext
{
    params: Promise<{ id: string; }>;
}

export function buildGantAllocateTimeRoutes<TEntity extends BaseGantItem>({
    dbSet,
}: BuildGantAllocateTimeRoutesProps<TEntity>)
{

    async function GET(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { id } = await context.params;
            const { searchParams } = new URL(request.url);
            const containerId = searchParams.get("containerId");

            if (!id || !containerId)
            {
                throw new ClientApiError("Both event id and containerId are required.");
            }

            const duration = await dbSet.getAllocatedTime(
                (id as GanttEventId),
                containerId
            );

            return ApiSuccess(duration);
        } catch (error)
        {
            return catchHandler(request, error);
        }
    }

    async function POST(request: NextRequest, context: RouteContext)
    {
        try
        {
            const { id } = await context.params;
            if (!id)
            {
                throw new ClientApiError("Item identifier (id) is missing.");
            }

            const body = await request.json(); // Use .json() instead of parsing .text()
            const { containerId, duration } = body as {
                containerId: BaseGantItem[ "id" ];
                duration: number;
            };

            if (!containerId || typeof duration !== "number")
            {
                throw new ClientApiError("Invalid payload: containerId and duration (number) are required.");
            }

            await dbSet.setAllocatedTime((id as GanttEventId), containerId, duration);

            return ApiSuccess({ success: true });
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
