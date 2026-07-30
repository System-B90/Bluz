"use client";
import { useCommandPaletteContext } from "./CommandPaletteContext";
import type { CommandId, CommandKind } from "./types";

export type UseCommandPaletteResult = {
    isOpen: boolean;
    open: (kind?: CommandKind | null) => void;
    close: () => void;
    toggle: (kind?: CommandKind | null) => void;
    /** Run a currently-contributed command by id without opening the palette UI. */
    runCommand: (id: CommandId) => void;
};

/** Imperative control of the palette, for toolbar buttons and the like. */
export function useCommandPalette(): UseCommandPaletteResult
{
    const { isOpen, open, close, toggle, registry } =
        useCommandPaletteContext();
    return {
        isOpen,
        open,
        close,
        toggle,
        runCommand: (id) => registry.run(id),
    };
}
