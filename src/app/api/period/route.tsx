export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbPeriod } from "@/api-server/period";
import { ClientApiError } from "@/api-shared/errors";
import { Period } from "@/components/schedule/types/event";
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
            return ApiSuccess(await DbPeriod.get(id));
        }
        else if (rawStartDate && rawEndDate)
        {
            return ApiSuccess(await DbPeriod.getInRange(new Date(rawStartDate), new Date(rawEndDate)));
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
        const period: Partial<Period> = await request.json();
        if (!period) { throw new ClientApiError('No data provided!'); }
        return ApiSuccess(await DbPeriod.set(period));
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
        const periodId: Period[ 'id' ] = await request.json();
        if (!periodId) { throw new ClientApiError('No periodId provided!'); }
        return ApiSuccess(await DbPeriod.del(periodId));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
