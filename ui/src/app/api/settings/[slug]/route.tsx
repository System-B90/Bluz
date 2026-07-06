export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    catchHandler,
    ServerApiWithParams,
} from "@/api-server/common";
import { DbSettings } from "@/api-server/db-settings";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { updatePrayerEvents } from "@/api-server/prayer";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
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

export const GET: ServerApiSettingGet = async (request, context) => {
    try {
        const { slug } = await context.params;

        const { controller } = await resolveIterationFromRequest(request);
        const data = await DbSettings.get(
            slug as SettingName,
            undefined,
            controller,
        );

        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiSettingUpdate = async (request, context) => {
    try {
        const { slug } = await context.params;
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const value: ApiSettingUpdatePayload = await request.json();

        if (slug === "prayerTimes") {
            inplaceDateFixup(value, "shacharit");
            inplaceDateFixup(value, "mincha");
            inplaceDateFixup(value, "arvit");
            await DbSettings.set(slug as SettingName, value, undefined, controller);

            await updatePrayerEvents({
                startDate: new Date(Date.now()),
                newConfig: value as PrayerSettings,
            });
        } else {
            await DbSettings.set(slug as SettingName, value, undefined, controller);
        }

        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
