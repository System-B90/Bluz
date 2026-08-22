export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    ServerApiWithParams,
    withApi,
} from "@/api-server/common";
import { DbSettings } from "@/api-server/db-settings";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { updatePrayerEvents } from "@/api-server/prayer";
import { requireStaffSession } from "@/api-server/session-user";
import { inplaceDateFixupToDate } from "@/api-shared/date-fixer";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    ApiSettingGetPayload,
    ApiSettingGetResponse,
    ApiSettingUpdatePayload,
    ApiSettingUpdateResponse,
    SettingName,
} from "@/api-shared/types/settings/settings";

type ServerApiSettingGet = ServerApiWithParams<
    ApiSettingGetPayload,
    ApiSettingGetResponse,
    { slug: string }
>;
type ServerApiSettingUpdate = ServerApiWithParams<
    ApiSettingUpdatePayload,
    ApiSettingUpdateResponse,
    { slug: string }
>;

export const GET: ServerApiSettingGet = withApi(async (request, context) => {
    await requireStaffSession();
    const { slug } = await context.params;

    const { controller } = await resolveIterationFromRequest(request);
    const data = await DbSettings.get(
        slug as SettingName,
        undefined,
        controller,
    );

    return ApiSuccess(data);
});

export const POST: ServerApiSettingUpdate = withApi(async (request, context) => {
    await requireStaffSession();
    const { slug } = await context.params;
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const value: ApiSettingUpdatePayload = await request.json();

    if (slug === "prayerTimes") {
        inplaceDateFixupToDate(value, "shacharit");
        inplaceDateFixupToDate(value, "mincha");
        inplaceDateFixupToDate(value, "arvit");
        await DbSettings.set(slug as SettingName, value, undefined, controller);

        await updatePrayerEvents({
            startDate: new Date(Date.now()),
            newConfig: value as PrayerSettings,
        });
    } else {
        await DbSettings.set(slug as SettingName, value, undefined, controller);
    }

    return ApiSuccess();
});
