export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbSettings } from "@/api-server/db-settings";
import { Setting, SettingName } from "@/api-shared/types/settings/settings";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; }>; }
)
{
    try
    {
        const { slug } = await params;

        const data = await DbSettings.get(slug as SettingName);

        return ApiSuccess(data);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; }>; }
)
{
    try
    {
        const { slug } = await params;
        const value: Partial<Setting> = await request.json();
        await DbSettings.set(slug as SettingName, value);
        return ApiSuccess();
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
