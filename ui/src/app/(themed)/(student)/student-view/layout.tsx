import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/api-server/hive/sso";
import { AuthSessionData } from "@/api-shared/types/sso";

/**
 * The student view sits *outside* the `(post-auth)` group on purpose: that
 * group's layout mounts the staff shell (app bar, command palette, Hive
 * providers, settings dialog, onboarding) and bounces non-staff away from it.
 * This layout mounts none of that — a student session has no staff React tree
 * to inspect, and nothing on the page suggests one exists (#656).
 *
 * Both staff and students may render this route: staff use it as the preview.
 */
export default async function StudentViewLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const session = (await getServerSession(
        authOptions,
    )) as AuthSessionData | null;

    if (!session?.user) {
        redirect("/login");
    }

    return <>{children}</>;
}
