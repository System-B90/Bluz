import fs from "fs";
import path from "path";

import { describe, it, expect } from "vitest";

/**
 * Regression guard for the "hidden prayer events render as solid black
 * blocks" bug: the filtered-out opacity rules in calendar.css matched
 * `.rbc-event-content > [data-filtered-out=...]` with a direct-child
 * combinator, but the element carrying `data-filtered-out`
 * (EventSegmentBlock, ui/src/components/schedule/event-component/base.tsx)
 * sits two levels deep — wrapped in an outer drag/drop-styling Box — so it
 * is a grandchild, never a direct child. The selector silently never
 * matched: the inner content correctly went to opacity 0, but `.rbc-event`'s
 * own opaque background stayed visible behind it.
 *
 * A future edit re-tightening the combinator back to `>` would reintroduce
 * that bug without any visible diff signal, since the CSS is still valid and
 * the mismatch only shows up at runtime in a real browser. This pins the
 * combinator statically.
 */

const CSS_PATH = path.resolve(
    __dirname,
    "../../ui/src/style/calendar.css",
);

describe("calendar.css filtered-out opacity selectors", () => {
    const css = fs.readFileSync(CSS_PATH, "utf-8");
    const selectorBlocks = [
        ...css.matchAll(
            /\.rbc-event:has\(([^)]*\[data-filtered-out="[^"]*"\][^)]*)\)/g,
        ),
    ];

    it("has all seven opacity-tier selectors present (1, 0.6, 0.4, 0.3, 0.2, 0.1, 0)", () => {
        expect(selectorBlocks).toHaveLength(7);
    });

    it("never uses a direct-child combinator before [data-filtered-out=...]", () => {
        for (const [, inner] of selectorBlocks) {
            // A direct child would read ".rbc-event-content > [data-filtered-out=".
            // The fix requires a descendant (space) combinator instead.
            expect(inner).not.toMatch(/>\s*\[data-filtered-out=/);
            expect(inner).toMatch(/\.rbc-event-content\s+\[data-filtered-out=/);
        }
    });
});
