'use server';
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/api-server/hive/sso";
import { AuthSessionUser } from "@/api-shared/types/sso";
import { AuthProvider } from "@/components/auth/AuthProvider";

export default async function PostAuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    const session = await getServerSession(authOptions);

    if (!session || !session.user)
    {
        redirect("/login");
    }

    return (
        <AuthProvider userData={ session.user as AuthSessionUser }>
            { children }
        </AuthProvider>
    );
}
