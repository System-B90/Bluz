"use client";
import { useEffect, useId } from "react";

import { useCommandPaletteContext } from "./CommandPaletteContext";
import type { CommandSource } from "./types";

/**
 * Contribute commands for as long as the calling component is mounted.
 *
 * `source` is either a plain array or — for sets too large to materialise
 * eagerly — a factory that receives the current query:
 *
 * ```tsx
 * const commands = useMemo(() => [{ id: "event.new", title: "אירוע חדש", run: open }], [open]);
 * useCommands(commands);
 * ```
 *
 * **`source` must be referentially stable** (`useMemo`/`useCallback`). A fresh
 * value every render would re-register on every render; a changed value is
 * exactly what tells an open palette to recompute.
 */
export function useCommands(source: CommandSource): void {
    const { registry } = useCommandPaletteContext();
    const id = useId();

    useEffect(() => registry.register(id, source), [registry, id, source]);
}
