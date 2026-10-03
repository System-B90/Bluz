/**
 * Name: block-tooltip.ts
 * Purpose: The hover text of a timeline bar: its full name (bars truncate),
 *   where it sits in the tree, and its hours, then any status notes (#828).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */

export const TREE_PATH_SEPARATOR = " › ";

export type BlockTooltipParts = {
    title?: string;
    /** Ancestors, outermost first (syllabus, then module). */
    path?: Array<string | undefined>;
    /** Formatted hours, e.g. "1.5 ש׳". */
    hoursLabel?: string;
    notes?: Array<string>;
};

/** One line per part, empty parts dropped. */
export function buildBlockTooltip({
    title,
    path = [],
    hoursLabel,
    notes = [],
}: BlockTooltipParts): string
{
    const trail = path.filter((p): p is string => Boolean(p)).join(TREE_PATH_SEPARATOR);
    return [ title, trail, hoursLabel, ...notes ]
        .filter((line): line is string => Boolean(line?.trim()))
        .join("\n");
}
