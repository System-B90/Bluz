"use client";
import LogoutIcon from "@mui/icons-material/Logout";
import { useCommands } from "@system-b90/command-palette";
import { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useAuth } from "@/components/auth/AuthProvider";

/** Account actions. Registered app-wide. Owned by the logged in user access
 * bar / the existing logout button (`useAuth().logout`). */
export function useAccountCommands(): void {
    const { logout } = useAuth();

    const commands = useMemo(
        () => [
            {
                id: "account.logout",
                title: "התנתקות",
                group: COMMAND_GROUPS.account,
                kind: "command" as const,
                icon: <LogoutIcon />,
                keywords: ["logout", "sign out", "exit", "התנתק"],
                run: () => logout(),
            },
        ],
        [logout],
    );

    useCommands(commands);
}
