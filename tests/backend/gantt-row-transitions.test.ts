import { describe, expect, it } from "vitest";

import { GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { mergeRowTransitions } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/row-transitions";

const row = (key: string): GridRow => ({
    kind: "event",
    id: key,
    key,
    syllabusId: "s",
    moduleId: "m",
    title: key,
    depth: 0,
    requiredMinutes: 0,
    weekMinutes: [],
    coursePresence: [],
});
const summary = (items: ReturnType<typeof mergeRowTransitions>) => items.map((i) => `${i.row.key}:${i.phase}`);

describe("mergeRowTransitions", () =>
{
    it("marks rows that appear as enter, in place", () =>
    {
        const merged = mergeRowTransitions([ row("a"), row("d") ], [ row("a"), row("b"), row("c"), row("d") ]);
        expect(summary(merged)).toEqual([ "a:stay", "b:enter", "c:enter", "d:stay" ]);
    });

    it("keeps rows that vanish as exit, in place", () =>
    {
        const merged = mergeRowTransitions([ row("a"), row("b"), row("c"), row("d") ], [ row("a"), row("d") ]);
        expect(summary(merged)).toEqual([ "a:stay", "b:exit", "c:exit", "d:stay" ]);
    });

    it("keeps everything as stay when nothing changed", () =>
    {
        const rows = [ row("a"), row("b") ];
        expect(summary(mergeRowTransitions(rows, rows))).toEqual([ "a:stay", "b:stay" ]);
    });
});
