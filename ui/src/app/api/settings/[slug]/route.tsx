export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbSettings } from "@/api-server/db-settings";
import { updatePrayerEvents } from "@/api-server/prayer";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import { Setting, SettingName } from "@/api-shared/types/settings/settings";

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

        if (slug === 'prayerTimes')
        {
            inplaceDateFixup(value, 'shacharit');
            inplaceDateFixup(value, 'mincha');
            inplaceDateFixup(value, 'arvit');
            await DbSettings.set(slug as SettingName, value);

            await updatePrayerEvents({ startDate: new Date(Date.now()), newConfig: value as PrayerSettings });
        }

        return ApiSuccess();
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
