import { describe, expect, it } from "vitest";

import {
    gridMenuActions,
    GridMenuInput,
    summaryRowsUnder,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-context-menu";
import { GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { selectCell, selectedCells, initialSelection } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-selection";

const row = (kind: GridRow["kind"], key: string, depth: number, extra: Partial<GridRow> = {}) =>
    ({ kind, key, id: key, depth, syllabusId: "s", moduleId: "m", title: key, requiredMinutes: 0, weekMinutes: [], coursePresence: [], ...extra }) as GridRow;

const input = (over: Partial<GridMenuInput>): GridMenuInput => ({
    row: row("event", "e", 2),
    week: null,
    placedInWeek: false,
    minutesInWeek: 0,
    expanded: false,
    editableSelected: 1,
    sharedAcrossShuffles: false,
    ...over,
});

describe("gridMenuActions (#858)", () => {
    it("event week cell with time: edit, clear, remove", () => {
        expect(gridMenuActions(input({ week: 0, placedInWeek: true, minutesInWeek: 60 })))
            .toEqual([ "open-dialog", null, "edit-week", "clear-week", "remove-mapping", null, "copy" ]);
    });

    it("a kept 0 can be removed but not cleared again", () => {
        const actions = gridMenuActions(input({ week: 0, placedInWeek: true, minutesInWeek: 0 }));
        expect(actions).toContain("remove-mapping");
        expect(actions).not.toContain("clear-week");
    });

    it("an unplaced week offers only edit", () => {
        const actions = gridMenuActions(input({ week: 1 }));
        expect(actions).toContain("edit-week");
        expect(actions).not.toContain("remove-mapping");
    });

    it("the title cell of an event has no week entries", () => {
        expect(gridMenuActions(input({}))).toEqual([ "open-dialog", null, "copy" ]);
    });

    it("an event shared by all shuffles offers the split", () => {
        expect(gridMenuActions(input({ sharedAcrossShuffles: true }))).toContain("split-shuffles");
    });

    it("summary rows toggle by their current state, plus subtree entries", () => {
        expect(gridMenuActions(input({ row: row("syllabus", "s", 0), expanded: true })))
            .toEqual([ "open-dialog", null, "collapse", "expand-all-under", "collapse-all-under", null, "copy" ]);
        expect(gridMenuActions(input({ row: row("module", "m", 1) }))).toContain("expand");
    });

    it("childless summary rows have nothing to expand", () => {
        expect(gridMenuActions(input({ row: row("module", "m", 1, { childless: true }) }))).toEqual([ "open-dialog", null, "copy" ]);
    });

    it("offers set-range only for several editable cells", () => {
        expect(gridMenuActions(input({ editableSelected: 3 }))).toContain("set-range");
        expect(gridMenuActions(input({ editableSelected: 1 }))).not.toContain("set-range");
    });
});

describe("summaryRowsUnder (#858)", () => {
    const all = [
        row("syllabus", "s1", 0),
        row("shuffle", "s1:a", 1),
        row("module", "m1", 2),
        row("event", "e1", 3),
        row("module", "m2", 2),
        row("syllabus", "s2", 0),
        row("module", "m3", 1),
    ];

    it("collects the row and its summary descendants, stopping at the next sibling", () => {
        expect(summaryRowsUnder(all, "s1").map((r) => r.key)).toEqual([ "s1", "s1:a", "m1", "m2" ]);
        expect(summaryRowsUnder(all, "m1").map((r) => r.key)).toEqual([ "m1" ]);
    });

    it("is empty for an unknown key", () => {
        expect(summaryRowsUnder(all, "nope")).toEqual([]);
    });
});

describe("selectedCells (#858)", () => {
    it("lists the range plus Ctrl-added cells, row-major and unique", () => {
        let s = selectCell(initialSelection(), { row: 1, col: 3 });
        s = selectCell(s, { row: 2, col: 4 }, { shift: true });
        s = selectCell(s, { row: 0, col: 3 }, { ctrl: true });
        expect(selectedCells(s)).toEqual([
            { row: 0, col: 3 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 2, col: 3 }, { row: 2, col: 4 },
        ]);
    });
});