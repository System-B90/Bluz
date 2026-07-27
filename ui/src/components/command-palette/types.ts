import type { ReactNode } from "react";

/**
 * Public contracts for the command palette package.
 *
 * Nothing in this directory may import from outside `command-palette/` other
 * than `react` and `@mui/*`. That constraint is what makes the package liftable
 * into a standalone library later.
 */

/** Stable identity of a command. Used for recents and de-duplication. */
export type CommandId = string;

/**
 * Which "lane" a command belongs to. Lanes map onto the VSCode-style query
 * prefixes handled in `core/modes.ts`:
 *
 * - `command` — an action to perform (`>`)
 * - `entity`  — a domain object to jump to (`@`)
 * - `goto`    — navigation to a place in the app (`:`)
 */
export type CommandKind = "command" | "entity" | "goto";

/** The parsed query handed to every registered factory. */
export type CommandQuery = {
    /** The query with any mode prefix stripped. Never `null`. */
    text: string;
    /** `null` means "no prefix typed" — every lane is in play. */
    kind: CommandKind | null;
};

export type Command = {
    id: CommandId;
    /** Primary label. Displayed as typed — expected to be in the app's locale. */
    title: string;
    /** Secondary line (path, context, description). Also matched, at low weight. */
    subtitle?: string;
    /** Section heading. Commands are grouped by this in the result list. */
    group?: string;
    /**
     * Extra match tokens that are never displayed — the place to put English
     * aliases for a Hebrew `title`, or synonyms ("prefs" for "settings").
     */
    keywords?: Array<string>;
    /** Defaults to `"command"`. */
    kind?: CommandKind;
    icon?: ReactNode;
    /** Display-only key hint, e.g. `["Ctrl", "Z"]`. Rendered as chips. */
    shortcut?: Array<string>;
    /** Rendered greyed-out and non-selectable when `false`. */
    enabled?: boolean;
    /** Static ranking nudge. Positive floats a command up. Defaults to `0`. */
    priority?: number;
    /** Keep the palette open after running (for toggles). Defaults to `false`. */
    keepOpen?: boolean;
    run: () => Promise<void> | void;
};

/**
 * Commands are contributed as a *factory* rather than a static array so that
 * large or query-dependent sets (thousands of calendar events, say) are only
 * materialised for the query actually being typed.
 */
export type CommandFactory = (query: CommandQuery) => Array<Command>;

/** What a contributor hands to `useCommands`. */
export type CommandSource = Array<Command> | CommandFactory;

/** A command plus the match metadata the list needs to render it. */
export type RankedCommand = {
    command: Command;
    score: number;
    /** Indices into `command.title` that matched, for highlighting. */
    titleMatches: Array<number>;
};

/** A contiguous block of ranked commands sharing a `group`. */
export type RankedGroup = {
    group: string;
    items: Array<RankedCommand>;
};

/** Strings the palette renders. Supplied by the host app so the package stays locale-free. */
export type CommandPaletteLabels = {
    placeholder: string;
    empty: string;
    recents: string;
    /** Per-lane display name, shown as a chip when a prefix is active. */
    kinds: Record<CommandKind, string>;
    hints: {
        navigate: string;
        run: string;
        close: string;
    };
};
