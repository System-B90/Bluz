import {
    createHiveClient as createHiveClientShared,
    createHiveClientFromSession as createHiveClientFromSessionShared,
} from "@system-b15/hive-nextauth";

import { HiveClient } from "@/api-server/hive/client";
import { authOptions } from "@/api-server/hive/sso";
import { AuthSessionData } from "@/api-shared/types/sso";

export async function createHiveClientFromSession(
    session: AuthSessionData,
    hiveUrl?: string,
): Promise<HiveClient> {
    return createHiveClientFromSessionShared(session, HiveClient, hiveUrl);
}

export async function createHiveClient(hiveUrl?: string): Promise<HiveClient> {
    return await createHiveClientShared(authOptions, HiveClient, hiveUrl);
}
