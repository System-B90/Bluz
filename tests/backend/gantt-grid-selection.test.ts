import { describe, expect, it } from "vitest";

import { initialSelection, isCellSelected, selectCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-selection";

/** Spreadsheet grid selection: plain, Shift range, Ctrl toggle. */

const selected = (s: ReturnType<typeof initialSelection>) =>
    [ 0, 1, 2 ].flatMap((row) => [ 0, 1, 2 ].filter((col) => isCellSelected(s, { row, col })).map((col) => `${row},${col}`));

describe("selectCell", () => {
    it("selects one cell plainly and a rectangle with Shift", () => {
        let s = selectCell(initialSelection(), { row: 1, col: 1 });
        expect(selected(s)).toEqual([ "1,1" ]);
        s = selectCell(s, { row: 2, col: 2 }, { shift: true });
        expect(selected(s)).toEqual([ "1,1", "1,2", "2,1", "2,2" ]);
        s = selectCell(s, { row: 0, col: 1 }, { shift: true });
        expect(selected(s)).toEqual([ "0,1", "1,1" ]);
    });

    it("adds and removes cells with Ctrl, keeping earlier ranges", () => {
        let s = selectCell(initialSelection(), { row: 0, col: 1 }, { shift: true });
        s = selectCell(s, { row: 2, col: 2 }, { ctrl: true });
        expect(selected(s)).toEqual([ "0,0", "0,1", "2,2" ]);
        s = selectCell(s, { row: 0, col: 0 }, { ctrl: true });
        expect(selected(s)).toEqual([ "0,1", "2,2" ]);
        s = selectCell(s, { row: 1, col: 0 }, { shift: true });
        expect(selected(s)).toEqual([ "0,0", "0,1", "1,0", "2,2" ]);
    });
});
