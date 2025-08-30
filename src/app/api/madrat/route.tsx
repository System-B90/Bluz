import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getMadratText, modifyMadratText } from "@/api-server/datastore";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest
)
{
    try
    {
        return ApiSuccess(await getMadratText());
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
        const newText = await request.text();
        await modifyMadratText(newText);
        return ApiSuccess();
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
