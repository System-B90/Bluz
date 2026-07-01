import { getServerSession } from "next-auth";

import { authOptions } from "@/api-server/hive/sso";
import { AuthSessionData } from "@/api-shared/types/sso";

export type SessionUser = {
    id: string;
    displayName: string;
};

/**
 * Resolves the currently authenticated user from the NextAuth session, or
 * `null` when there is no active session. Use for attributing server-side
 * writes (e.g. who last edited a shared draft).
 */
export async function getSessionUser(): Promise<null | SessionUser> {
    const session = (await getServerSession(authOptions)) as
        | AuthSessionData
        | null;
    if (!session?.user) {
        return null;
    }
    return {
        id: session.user.id,
        displayName:
            session.user.display_name || session.user.name || "משתמש",
    };
}
