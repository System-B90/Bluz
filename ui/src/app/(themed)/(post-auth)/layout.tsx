"use server";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { isHiveReachable } from "@/api-server/hive/health";
import { authOptions } from "@/api-server/hive/sso";
import { AuthSessionData, AuthSessionUser } from "@/api-shared/types/sso";
import { AuthProvider } from "@/components/auth/AuthProvider";

export default async function PostAuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = (await getServerSession(
        authOptions,
    )) as AuthSessionData | null;

    if (!session || !session.user) {
        redirect("/login");
    }

    // A stale token normally forces re-login, but that requires Hive to be
    // up. If Hive is unreachable, fall back to the cached session instead
    // of locking the user out entirely.
    let degraded = false;
    if (session.error === "TokenExpiredError") {
        if (await isHiveReachable()) {
            redirect("/login");
        }
        degraded = true;
    }

    return (
        <AuthProvider degraded={degraded} userData={session.user as AuthSessionUser}>
            {children}
        </AuthProvider>
    );
}
