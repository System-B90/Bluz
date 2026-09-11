import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { isHiveReachable } from "@/api-server/hive/health";
import { authOptions } from "@/api-server/hive/sso";
import { Clearance } from "@/api-shared/types/hive";
import { AuthSessionData, AuthSessionUser } from "@/api-shared/types/sso";
import { STUDENT_VIEW_PATH } from "@/api-shared/types/student-view";
import { AuthProvider } from "@/components/auth/AuthProvider";

export default async function PostAuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    const session = (await getServerSession(
        authOptions,
    )) as AuthSessionData | null;

    if (!session || !session.user)
    {
        redirect("/login");
    }

    // Every staff page in the app lives under this layout, so this one check
    // keeps a student session out of all of them (#656). It runs before any
    // child renders, so no staff page ever fetches on a student's behalf.
    // The redirect is silent and unconditional: no error, no "access denied"
    // screen, nothing that hints the rest of the app is there.
    if (
        session.user.clearance !== Clearance.Segel &&
        session.user.clearance !== Clearance.Admin
    )
    {
        redirect(STUDENT_VIEW_PATH);
    }

    // A stale token normally forces re-login, but that requires Hive to be
    // up. If Hive is unreachable, fall back to the cached session instead
    // of locking the user out entirely.
    let degraded = false;
    if (session.error === "TokenExpiredError")
    {
        if (await isHiveReachable())
        {
            redirect("/login");
        }
        degraded = true;
    }

    return (
        <AuthProvider degraded={ degraded } userData={ session.user as AuthSessionUser }>
            { children }
        </AuthProvider>
    );
}
