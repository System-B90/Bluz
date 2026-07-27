import type {
    Command,
    CommandQuery,
    RankedCommand,
    RankedGroup,
} from "../types";

import { matchText } from "./fuzzy";
import type { RecentsStore } from "./recents";

/**
 * Fields other than the title are matched at a discount, so a title hit always
 * beats an equally-good hit on a hidden keyword or a subtitle.
 */
const KEYWORD_WEIGHT = 0.85;
const SUBTITLE_WEIGHT = 0.6;
const GROUP_WEIGHT = 0.4;

/** Scale applied to `command.priority` before it enters the score. */
const PRIORITY_WEIGHT = 20;

/** Hard cap on rendered rows. Well past what anyone scrolls through. */
const MAX_RESULTS = 60;

export type RankOptions = {
    recents: RecentsStore;
    limit?: number;
};

/** Score one command, or `null` when it does not match at all. */
function rankOne(
    command: Command,
    query: CommandQuery,
    recents: RecentsStore,
): null | RankedCommand {
    const base = recents.boost(command.id) + (command.priority ?? 0) * PRIORITY_WEIGHT;

    if (!query.text) {
        return { command, score: 1 + base, titleMatches: [] };
    }

    const title = matchText(query.text, command.title);
    let best = title.score;

    for (const keyword of command.keywords ?? []) {
        best = Math.max(best, matchText(query.text, keyword).score * KEYWORD_WEIGHT);
    }
    if (command.subtitle) {
        best = Math.max(
            best,
            matchText(query.text, command.subtitle).score * SUBTITLE_WEIGHT,
        );
    }
    if (command.group) {
        best = Math.max(
            best,
            matchText(query.text, command.group).score * GROUP_WEIGHT,
        );
    }

    if (best <= 0) return null;

    return {
        command,
        score: best + base,
        titleMatches: title.score > 0 ? title.indices : [],
    };
}

/**
 * Filter to the queried lane, score, and sort. Disabled commands are kept (the
 * list renders them greyed out) but pushed below everything selectable.
 */
export function rankCommands(
    commands: Array<Command>,
    query: CommandQuery,
    { recents, limit = MAX_RESULTS }: RankOptions,
): Array<RankedCommand> {
    const ranked: Array<RankedCommand> = [];

    for (const command of commands) {
        const kind = command.kind ?? "command";
        if (query.kind && kind !== query.kind) continue;

        const result = rankOne(command, query, recents);
        if (result) ranked.push(result);
    }

    ranked.sort((a, b) => {
        const enabledDelta =
            Number(b.command.enabled !== false) -
            Number(a.command.enabled !== false);
        if (enabledDelta !== 0) return enabledDelta;
        if (b.score !== a.score) return b.score - a.score;
        return a.command.title.localeCompare(b.command.title);
    });

    return ranked.slice(0, limit);
}

/**
 * Bucket an already-sorted list into contiguous group blocks. Group order
 * follows each group's best-scoring member, so the section you are actually
 * searching for floats to the top.
 */
export function groupRanked(ranked: Array<RankedCommand>): Array<RankedGroup> {
    const groups: Array<RankedGroup> = [];
    const byName = new Map<string, RankedGroup>();

    for (const item of ranked) {
        const name = item.command.group ?? "";
        let group = byName.get(name);
        if (!group) {
            group = { group: name, items: [] };
            byName.set(name, group);
            groups.push(group);
        }
        group.items.push(item);
    }

    return groups;
}

/** Flatten grouped results back to a selectable-index-ordered list. */
export function flattenGroups(
    groups: Array<RankedGroup>,
): Array<RankedCommand> {
    return groups.flatMap((group) => group.items);
}
