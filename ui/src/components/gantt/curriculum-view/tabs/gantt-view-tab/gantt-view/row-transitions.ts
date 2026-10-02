import { GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";

export type RowPhase = "enter" | "exit" | "stay";
export type TransitionRow = { row: GridRow; phase: RowPhase };

const rowId = (row: GridRow) => `${row.kind}-${row.key}`;

/**
 * Display rows while a collapse/expand animates: the new rows, the ones that
 * just appeared marked `enter`, and the ones that just vanished kept in place
 * as `exit` until the caller drops them. Rows keep their relative order.
 */
export function mergeRowTransitions(previous: Array<GridRow>, next: Array<GridRow>): Array<TransitionRow>
{
    const nextIds = new Set(next.map(rowId));
    const previousIds = new Set(previous.map(rowId));
    const merged: Array<TransitionRow> = [];
    let i = 0;
    let j = 0;
    while (i < previous.length || j < next.length)
    {
        const old = previous[ i ];
        const current = next[ j ];
        if (old && !nextIds.has(rowId(old)))
        {
            merged.push({ row: old, phase: "exit" });
            i++;
        }
        else if (current && !previousIds.has(rowId(current)))
        {
            merged.push({ row: current, phase: "enter" });
            j++;
        }
        else if (current)
        {
            merged.push({ row: current, phase: "stay" });
            // Same row in both: advance both. A reorder just advances the new side.
            if (old && rowId(old) === rowId(current)) i++;
            j++;
        }
        else i++;
    }
    return merged;
}
