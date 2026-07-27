"use client";
import { useCommandPaletteContext } from "./CommandPaletteContext";
import type { CommandKind } from "./types";

export type UseCommandPaletteResult = {
    isOpen: boolean;
    open: (kind?: CommandKind | null) => void;
    close: () => void;
    toggle: (kind?: CommandKind | null) => void;
};

/** Imperative control of the palette, for toolbar buttons and the like. */
export function useCommandPalette(): UseCommandPaletteResult {
    const { isOpen, open, close, toggle } = useCommandPaletteContext();
    return { isOpen, open, close, toggle };
}
