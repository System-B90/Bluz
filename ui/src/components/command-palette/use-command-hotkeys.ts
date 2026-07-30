"use client";
import { useEffect } from "react";

import { matchesShortcut } from "./core/hotkeys";
import type { CommandRegistry } from "./core/registry";

const INPUT_TAGS = new Set(["input", "textarea"]);

/**
 * Global keydown capture for every contributed command that declares a
 * `shortcut`. This is the single place a `Command.shortcut` chip actually
 * becomes live — contributors only need to declare it, not also wire a
 * window listener of their own.
 */
export function useCommandHotkeys(registry: CommandRegistry): void {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag && INPUT_TAGS.has(activeTag)) return;

            const commands = registry.collect({ text: "", kind: null });
            const command = commands.find(
                (c) => c.shortcut && matchesShortcut(event, c.shortcut),
            );
            if (!command || command.enabled === false) return;

            event.preventDefault();
            void command.run();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [registry]);
}
