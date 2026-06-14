"use server";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

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

    if (!session || !session.user || session.error === "TokenExpiredError") {
        redirect("/login");
    }

    return (
        <AuthProvider userData={session.user as AuthSessionUser}>
            {children}
        </AuthProvider>
    );
}
