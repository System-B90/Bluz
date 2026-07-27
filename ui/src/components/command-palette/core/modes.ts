import type { CommandKind, CommandQuery } from "../types";

/**
 * VSCode-style query prefixes. Typing the prefix as the first character of the
 * query narrows the palette to a single lane; with no prefix every lane is
 * searched at once, which is the friendlier default for users who don't know
 * the prefixes exist.
 */
export const KIND_PREFIXES: Record<string, CommandKind> = {
    ">": "command",
    "@": "entity",
    ":": "goto",
};

export const PREFIX_BY_KIND: Record<CommandKind, string> = {
    command: ">",
    entity: "@",
    goto: ":",
};

/**
 * Split a raw input value into its lane prefix and the remaining search text.
 *
 * The prefix is the first character of the *logical* string. It never reaches
 * the visible field — the dialog strips it into a lane chip — so its position
 * is unaffected by the layout direction.
 */
export function parseQuery(raw: string): CommandQuery {
    const prefix = raw.charAt(0);
    const kind = KIND_PREFIXES[prefix];

    if (kind) {
        return { kind, text: raw.slice(1).trimStart() };
    }

    return { kind: null, text: raw.trimStart() };
}

/** Build the raw input value that selects `kind`, preserving any typed text. */
export function buildRawQuery(kind: CommandKind | null, text = ""): string {
    return kind ? `${PREFIX_BY_KIND[kind]}${text}` : text;
}
