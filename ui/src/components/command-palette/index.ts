/**
 * Command palette — a VSCode-style quick-open surface.
 *
 * Self-contained by design: nothing under `command-palette/` imports from the
 * host application, so the directory can be lifted into a shared package.
 * See `README.md` for the extraction checklist.
 */

export { CommandPaletteProvider } from "./CommandPaletteProvider";
export type { CommandPaletteProviderProps } from "./CommandPaletteProvider";
export { useCommandPalette } from "./use-command-palette";
export type { UseCommandPaletteResult } from "./use-command-palette";
export { useCommands } from "./use-commands";
export type { PaletteHotkeyOptions } from "./use-open-palette-hotkeys";

export type {
    Command,
    CommandFactory,
    CommandId,
    CommandKind,
    CommandPaletteLabels,
    CommandQuery,
    CommandSource,
    RankedCommand,
    RankedGroup,
} from "./types";

// Escape hatches for hosts that want to reuse the matcher (e.g. an in-page
// search field that should rank the same way the palette does).
export { matchText } from "./core/fuzzy";
export type { MatchResult } from "./core/fuzzy";
export { normalizeText } from "./core/text";
export { KIND_PREFIXES, PREFIX_BY_KIND } from "./core/modes";
