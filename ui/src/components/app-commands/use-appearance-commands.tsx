"use client";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useCommands } from "@system-b90/command-palette";
import { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useTheme } from "@/components/theme/ThemeProvider";

/** Theme switching. Registered app-wide. */
export function useAppearanceCommands(): void {
    const { theme, resolvedTheme, setTheme } = useTheme();

    const commands = useMemo(
        () => [
            {
                id: "appearance.toggle",
                title: "החלפת ערכת נושא",
                subtitle: resolvedTheme === "dark" ? "כהה → בהיר" : "בהיר → כהה",
                group: COMMAND_GROUPS.appearance,
                kind: "command" as const,
                icon:
                    resolvedTheme === "dark" ? (
                        <LightModeIcon />
                    ) : (
                        <DarkModeIcon />
                    ),
                keywords: ["theme", "toggle", "dark", "light", "ערכת נושא"],
                run: () =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark"),
            },
            {
                id: "appearance.dark",
                title: "מצב כהה",
                group: COMMAND_GROUPS.appearance,
                kind: "command" as const,
                icon: <DarkModeIcon />,
                keywords: ["dark mode", "night"],
                enabled: theme !== "dark",
                run: () => setTheme("dark"),
            },
            {
                id: "appearance.light",
                title: "מצב בהיר",
                group: COMMAND_GROUPS.appearance,
                kind: "command" as const,
                icon: <LightModeIcon />,
                keywords: ["light mode", "day"],
                enabled: theme !== "light",
                run: () => setTheme("light"),
            },
            {
                id: "appearance.system",
                title: "לפי הגדרות המערכת",
                group: COMMAND_GROUPS.appearance,
                kind: "command" as const,
                icon: <BrightnessAutoIcon />,
                keywords: ["system", "auto"],
                enabled: theme !== "system",
                run: () => setTheme("system"),
            },
        ],
        [theme, resolvedTheme, setTheme],
    );

    useCommands(commands);
}
