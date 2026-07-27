"use client";
import { useEffect } from "react";

import type { CommandKind } from "./types";

export type PaletteHotkeyOptions = {
    /** `Ctrl/⌘ + K` — opens with every lane in play. */
    quickOpen?: boolean;
    /** `Ctrl/⌘ + Shift + P` — opens pre-filtered to the command lane. */
    commandMode?: boolean;
};

/**
 * Window-level open shortcuts.
 *
 * Both are modifier combinations, so unlike a bare-key shortcut they are safe
 * to bind globally: they cannot fire while the user is typing into a field.
 */
export function useOpenPaletteHotkeys(
    open: (kind?: CommandKind | null) => void,
    { quickOpen = true, commandMode = true }: PaletteHotkeyOptions = {},
): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;

            const key = event.key.toLowerCase();

            if (commandMode && event.shiftKey && key === "p") {
                event.preventDefault();
                open("command");
                return;
            }

            // `event.key` is "k" regardless of Shift on most layouts; require it
            // to be absent so the two bindings stay distinct.
            if (quickOpen && !event.shiftKey && key === "k") {
                event.preventDefault();
                open(null);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, quickOpen, commandMode]);
}
