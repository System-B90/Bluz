export type GridCell = { row: number; col: number };

/**
 * Spreadsheet selection: the range from anchor to cursor, plus cells kept
 * from earlier Ctrl+click ranges.
 */
export type GridSelection = {
    /** Null after Ctrl+click deselects a cell: the cursor sits there with no range. */
    anchor: GridCell | null;
    cursor: GridCell;
    extra: Set<string>;
};

const cellKey = ({ row, col }: GridCell) => `${row},${col}`;

const inRange = (cell: GridCell, a: GridCell, b: GridCell) =>
    cell.row >= Math.min(a.row, b.row) && cell.row <= Math.max(a.row, b.row)
    && cell.col >= Math.min(a.col, b.col) && cell.col <= Math.max(a.col, b.col);

export const initialSelection = (): GridSelection =>
    ({ anchor: { row: 0, col: 0 }, cursor: { row: 0, col: 0 }, extra: new Set() });

export const isCellSelected = (selection: GridSelection, cell: GridCell) =>
    (selection.anchor !== null && inRange(cell, selection.anchor, selection.cursor))
    || selection.extra.has(cellKey(cell));

const rangeKeys = (a: GridCell, b: GridCell) =>
{
    const keys: Array<string> = [];
    for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++)
        for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++)
            keys.push(cellKey({ row, col }));
    return keys;
};

/**
 * Move the cursor to a cell. Plain: select only it. Shift: extend the range
 * from the anchor. Ctrl: keep the current selection and toggle the cell.
 */
export function selectCell(selection: GridSelection, cell: GridCell, mode: { shift?: boolean; ctrl?: boolean } = {}): GridSelection
{
    if (mode.shift) return { ...selection, anchor: selection.anchor ?? selection.cursor, cursor: cell };
    if (!mode.ctrl) return { anchor: cell, cursor: cell, extra: new Set() };
    const extra = new Set([
        ...selection.extra,
        ...(selection.anchor ? rangeKeys(selection.anchor, selection.cursor) : []),
    ]);
    if (extra.has(cellKey(cell)))
    {
        extra.delete(cellKey(cell));
        return { anchor: null, cursor: cell, extra };
    }
    return { anchor: cell, cursor: cell, extra };
}

/** Every selected cell, row-major, de-duplicated (the range plus Ctrl+click extras). */
export function selectedCells(selection: GridSelection): Array<GridCell>
{
    const keys = new Set([
        ...(selection.anchor ? rangeKeys(selection.anchor, selection.cursor) : []),
        ...selection.extra,
    ]);
    return [ ...keys ]
        .map((key) => key.split(",").map(Number))
        .map(([ row, col ]) => ({ row, col }))
        .sort((a, b) => a.row - b.row || a.col - b.col);
}
