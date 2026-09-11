export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { requireStaffSession } from "@/api-server/session-user";
import { PersonalSettings } from "@/api-shared/types/personal-settings";

// Staff-only: personal settings are a staff surface, and the student view has
// no settings of any kind (#656).
async function resolveUserId(): Promise<string> {
    const user = await requireStaffSession();
    return user.id;
}

/** GET /api/personal-settings — fetch the current user's personal settings. */
export const GET = withApi(async () => {
    const userId = await resolveUserId();
    return ApiSuccess(await DbPersonalSettings.get(userId), "no-store");
});

/** POST /api/personal-settings — replace the current user's personal settings. */
export const POST = withApi(async (request: Request) => {
    const userId = await resolveUserId();
    const body = await requireJsonObjectBody<PersonalSettings>(request);
    return ApiSuccess(await DbPersonalSettings.set(userId, body));
});
