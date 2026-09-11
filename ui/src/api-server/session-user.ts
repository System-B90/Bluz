import { getServerSession } from "next-auth";

import { authOptions } from "@/api-server/hive/sso";
import { ForbiddenError, UserNotLoggedInError } from "@/api-shared/errors";
import { Clearance } from "@/api-shared/types/hive";
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

/**
 * Non-throwing clearance check for *page* (RSC) code, where a throw becomes a
 * 500 rather than a 403. Callers redirect on `false`. Route handlers must use
 * {@link requireStaffSession} instead.
 * @returns The session user when they hold Segel/Admin clearance, else null.
 */
export async function getStaffSession(): Promise<
    AuthSessionData["user"] | null
    > {
    const session = (await getServerSession(authOptions)) as
        | AuthSessionData
        | null;
    if (!session?.user) return null;
    const { clearance } = session.user;
    if (clearance !== Clearance.Segel && clearance !== Clearance.Admin) {
        return null;
    }
    return session.user;
}

/**
 * Gates a route to Segel/Admin clearance (#199). Every request re-checks the
 * JWT, not just the one-time sign-in gate in `sso.ts`'s `signInCallback`.
 * Throws so callers can just `await requireStaffSession()` at the top of a
 * `withApi` handler and let `catchHandler` map it to 401/403.
 */
export async function requireStaffSession(): Promise<AuthSessionData["user"]> {
    const session = (await getServerSession(authOptions)) as
        | AuthSessionData
        | null;
    if (!session?.user) {
        throw new UserNotLoggedInError("Unauthorized: No active session found.");
    }
    if (
        session.user.clearance !== Clearance.Segel &&
        session.user.clearance !== Clearance.Admin
    ) {
        throw new ForbiddenError("Forbidden: insufficient clearance.");
    }
    return session.user;
}
