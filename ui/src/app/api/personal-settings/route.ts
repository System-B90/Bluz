export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { getSessionUser } from "@/api-server/session-user";
import { UserNotLoggedInError } from "@/api-shared/errors";
import { PersonalSettings } from "@/api-shared/types/personal-settings";

async function resolveUserId(): Promise<string> {
    const user = await getSessionUser();
    if (!user) {
        throw new UserNotLoggedInError("אינך מחובר");
    }
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
    const body = (await request.json()) as PersonalSettings;
    return ApiSuccess(await DbPersonalSettings.set(userId, body));
});
