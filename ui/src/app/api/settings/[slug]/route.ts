export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    requireJsonObjectBody,
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
import { ClientApiError } from "@/api-shared/errors";
import { MEAL_TIMES_SETTING_KEY } from "@/api-shared/types/settings/meal";
import {
    PRAYER_TIMES_SETTING_KEY,
    PrayerSettings,
} from "@/api-shared/types/settings/prayer";
import { SCHEDULE_SETTINGS_KEY } from "@/api-shared/types/settings/schedule";
import {
    ApiSettingGetPayload,
    ApiSettingGetResponse,
    ApiSettingUpdatePayload,
    ApiSettingUpdateResponse,
    SettingName,
} from "@/api-shared/types/settings/settings";

const SETTING_NAMES: ReadonlySet<string> = new Set<SettingName>([
    MEAL_TIMES_SETTING_KEY,
    PRAYER_TIMES_SETTING_KEY,
    SCHEDULE_SETTINGS_KEY,
]);

/** Narrows the URL slug to a known setting; anything else is a 400. */
function requireSettingName(slug: string): SettingName {
    if (!SETTING_NAMES.has(slug)) {
        throw new ClientApiError(`הגדרה לא מוכרת: ${slug}`);
    }
    return slug as SettingName;
}

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

    const name = requireSettingName(slug);
    const { controller } = await resolveIterationFromRequest(request);
    const data = await DbSettings.get(name, undefined, controller);

    // Every calendar/gantt render reads these, so a short private cache
    // collapses bursts - but not `immutable` and not a day: another user's
    // change (or a WS push missed while the tab slept) has to show up on the
    // next reload, not tomorrow.
    return ApiSuccess(data, {
        maxAge: 60,
        scope: "private",
        immutable: false,
    });
});

export const POST: ServerApiSettingUpdate = withApi(
    async (request, context) => {
        await requireStaffSession();
        const { slug } = await context.params;
        const name = requireSettingName(slug);
        const { controller, iterationId } =
            await resolveWritableIterationFromRequest(request);
        const value =
            await requireJsonObjectBody<ApiSettingUpdatePayload>(request);

        if (name === PRAYER_TIMES_SETTING_KEY) {
            inplaceDateFixupToDate(value, "shacharit");
            inplaceDateFixupToDate(value, "mincha");
            inplaceDateFixupToDate(value, "arvit");
            await DbSettings.set(name, value, { upsert: true }, controller);

            // Same iteration DB the setting was just written to - the default
            // controller points at the legacy `bluz` DB, not the current run.
            await updatePrayerEvents({
                startDate: new Date(Date.now()),
                newConfig: value as PrayerSettings,
                controller,
                iterationId,
            });
        } else {
            await DbSettings.set(name, value, { upsert: true }, controller);
        }

        return ApiSuccess();
    },
);
