export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbEvent } from "@/api-server/event";
import { ClientApiError } from "@/api-shared/errors";
import { Event } from "@/components/schedule/types/event";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest
)
{
    try
    {
        const id = request.nextUrl.searchParams.get('id');
        const rawStartDate = request.nextUrl.searchParams.get('sd');
        const rawEndDate = request.nextUrl.searchParams.get('ed');

        if (!id && !(rawStartDate && rawEndDate)) { throw new ClientApiError('No id provided!'); }
        if (id)
        {
            return ApiSuccess(await DbEvent.get(id));
        }
        else if (rawStartDate && rawEndDate)
        {
            return ApiSuccess(await DbEvent.getInRange(new Date(rawStartDate), new Date(rawEndDate)));
        }
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function POST(
    request: NextRequest
)
{
    try
    {
        const event: Partial<Event> = await request.json();
        if (!event) { throw new ClientApiError('No data provided!'); }
        return ApiSuccess(await DbEvent.set(event));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function DELETE(
    request: NextRequest
)
{
    try
    {
        const eventId: Event[ 'id' ] = await request.json();
        if (!eventId) { throw new ClientApiError('No eventId provided!'); }
        return ApiSuccess(await DbEvent.del(eventId));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
