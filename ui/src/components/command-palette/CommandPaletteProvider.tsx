"use client";
import { ReactNode, useCallback, useMemo, useState } from "react";

import {
    CommandPaletteContext,
    CommandPaletteContextValue,
} from "./CommandPaletteContext";
import { CommandPaletteDialog } from "./CommandPaletteDialog";
import { buildRawQuery } from "./core/modes";
import { RecentsStore } from "./core/recents";
import { CommandRegistry } from "./core/registry";
import type { CommandKind, CommandPaletteLabels } from "./types";
import { useCommandHotkeys } from "./use-command-hotkeys";
import {
    PaletteHotkeyOptions,
    useOpenPaletteHotkeys,
} from "./use-open-palette-hotkeys";

export type CommandPaletteProviderProps = {
    children: ReactNode;
    /** Locale strings. The package ships no copy of its own. */
    labels: CommandPaletteLabels;
    /** Namespaces the persisted recents. Use one per host app. */
    storageNamespace?: string;
    hotkeys?: PaletteHotkeyOptions;
    /** Width of the palette sheet. Defaults to `640`. */
    width?: number;
};

/**
 * Owns the registry, the recents store and the open/query state, and renders
 * the palette itself. Mount it once, high enough that every command
 * contributor is inside it.
 */
export function CommandPaletteProvider({
    children,
    labels,
    storageNamespace = "default",
    hotkeys,
    width,
}: CommandPaletteProviderProps) {
    const registry = useMemo(() => new CommandRegistry(), []);
    const recents = useMemo(
        () => new RecentsStore(storageNamespace),
        [storageNamespace],
    );

    const [isOpen, setIsOpen] = useState(false);
    const [rawQuery, setRawQuery] = useState("");

    const open = useCallback((kind: CommandKind | null = null) => {
        setRawQuery(buildRawQuery(kind));
        setIsOpen(true);
    }, []);

    const close = useCallback(() => setIsOpen(false), []);

    const toggle = useCallback(
        (kind: CommandKind | null = null) => {
            setIsOpen((wasOpen) => {
                if (!wasOpen) setRawQuery(buildRawQuery(kind));
                return !wasOpen;
            });
        },
        [],
    );

    useOpenPaletteHotkeys(open, hotkeys);
    useCommandHotkeys(registry);

    const value = useMemo<CommandPaletteContextValue>(
        () => ({
            registry,
            recents,
            labels,
            isOpen,
            rawQuery,
            setRawQuery,
            open,
            close,
            toggle,
        }),
        [registry, recents, labels, isOpen, rawQuery, open, close, toggle],
    );

    return (
        <CommandPaletteContext.Provider value={value}>
            {children}
            <CommandPaletteDialog width={width} />
        </CommandPaletteContext.Provider>
    );
}
