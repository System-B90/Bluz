export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { ClientApiError } from "@/api-shared/errors";

type RouteContext = {
    params: Promise<{ id: string; }>;
};

export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id } = await context.params;
        if (!id)
        {
            throw new ClientApiError(
                "Event identifier (id) is missing from the request parameters.",
            );
        }

        const textBody = await request.text();
        const payload = textBody
            ? (JSON.parse(textBody) as { moduleId: string; })
            : null;

        if (!payload?.moduleId)
        {
            throw new ClientApiError(
                "moduleId is required in the request body.",
            );
        }

        const originalEvent = await DbModuleEvent.getItem(id);
        const newTitle = getNextIndexedTitle(originalEvent.title);

        const duplicatedEvent = await DbModuleEvent.createNewItem({
            title: newTitle,
            type: originalEvent.type,
            minimumDuration: originalEvent.minimumDuration,
            allocatedDuration: 0,
            moduleId: payload.moduleId,
        });

        return ApiSuccess(duplicatedEvent);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

function getNextIndexedTitle(title: string): string
{
    const match = title.match(/^(.*?)\s*\((\d+)\)$/);

    if (match)
    {
        const baseName = match[ 1 ];
        const currentIndex = parseInt(match[ 2 ], 10);
        return `${baseName} (${currentIndex + 1})`;
    }

    return `${title} (2)`;
}
