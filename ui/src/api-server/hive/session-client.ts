import { getServerSession } from "next-auth";

import { HiveClient } from "@/api-server/hive/client";
import { authOptions } from "@/api-server/hive/sso";
import { UserNotLoggedInError } from "@/api-shared/errors";
import { AuthSessionData } from "@/api-shared/types/sso";

export async function createHiveClientFromSession(
    session: AuthSessionData,
): Promise<HiveClient> {
    if (!session.accessToken) {
        throw new UserNotLoggedInError(
            "Unauthorized: Active session or access token is missing.",
        );
    }

    const hiveClient = new HiveClient(
        session.accessToken as string,
        session.refreshToken as string,
    );

    return hiveClient;
}

export async function createHiveClient(): Promise<HiveClient> {
    const session = await getServerSession(authOptions);
    if (!session) {
        throw new UserNotLoggedInError(
            "Unauthorized: No active session found.",
        );
    }
    return await createHiveClientFromSession(session as AuthSessionData);
}
