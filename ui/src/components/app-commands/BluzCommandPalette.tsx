"use client";
import { CommandPaletteProvider } from "@system-b90/command-palette";
import { ReactNode } from "react";

import { PALETTE_LABELS } from "@/components/app-commands/labels";
import { useAppearanceCommands } from "@/components/app-commands/use-appearance-commands";
import { useDirectoryCommands } from "@/components/app-commands/use-directory-commands";
import { useNavigationCommands } from "@/components/app-commands/use-navigation-commands";
import { useSettingsCommands } from "@/components/app-commands/use-settings-commands";

/** Registers the commands that are available from anywhere in the app. */
function AppCommands() {
    useNavigationCommands();
    useSettingsCommands();
    useAppearanceCommands();
    useDirectoryCommands();

    return null;
}

/**
 * Bluz's palette. Wraps the generic package with this app's copy and its
 * app-wide commands.
 *
 * Must be mounted inside the data providers the app-wide commands read from
 * (rooms, outsiders, theme) and outside everything that contributes commands of
 * its own — which in practice means inside the post-auth layout.
 */
export function BluzCommandPalette({ children }: { children: ReactNode }) {
    return (
        <CommandPaletteProvider labels={PALETTE_LABELS} storageNamespace="bluz">
            <AppCommands />
            {children}
        </CommandPaletteProvider>
    );
}
