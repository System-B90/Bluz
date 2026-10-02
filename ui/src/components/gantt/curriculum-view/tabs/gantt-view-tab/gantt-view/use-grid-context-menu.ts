import { useSnackbar } from "notistack";
import { useState } from "react";

import { GanttEvent } from "@/api-shared/types/gantt/models";
import { parseHoursInput, ZeroChoice } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-allotment";
import { gridMenuActions, GridMenuAction, summaryRowsUnder } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-context-menu";
import { GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { GridCell, GridSelection, isCellSelected, selectedCells } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-selection";
import { GridMenuTarget } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GridContextMenu";

export type GridMenuState = GridMenuTarget & { cell: GridCell; text: string };

/** What the grid lends its right-click menu: every entry reuses a keyboard handler. */
export type GridContextMenuDeps = {
    rows: Array<GridRow>;
    /** Every summary row open, so subtree entries reach collapsed descendants. */
    allRows: () => Array<GridRow>;
    events: Record<string, GanttEvent | undefined>;
    /** Columns before the first week (title, sum, courses). */
    leadColumns: number;
    selection: GridSelection;
    select: (cell: GridCell) => void;
    isEditable: (row: number, col: number) => boolean;
    placedWeeks: ReadonlySet<string>;
    isModuleExpanded: (key: string) => boolean;
    isSyllabusExpanded: (key: string) => boolean;
    sharedOf: (row: GridRow) => unknown;
    openDialog: (row: GridRow) => void;
    setExpanded: (row: GridRow, open: boolean) => void;
    startEdit: (row: number, col: number) => void;
    writeWeek: (cell: GridCell, minutes: number, zero?: ZeroChoice) => Promise<void>;
    splitShuffles: (eventId: string, moduleId: string, shuffles: Array<string>) => Promise<void>;
};

/**
 * The gantt table's right-click menu (#858): which entries a cell offers,
 * and what each one does. Rendering stays in {@link GridContextMenu}.
 */
export function useGridContextMenu(deps: GridContextMenuDeps)
{
    const { enqueueSnackbar } = useSnackbar();
    const [ menu, setMenu ] = useState<GridMenuState | null>(null);

    const openMenu = (e: React.MouseEvent<HTMLElement>, cell: GridCell) =>
    {
        const r = deps.rows[ cell.row ];
        if (!r) return;
        e.preventDefault();
        // Like a left-click, but an existing range survives a right-click inside it.
        const inSelection = isCellSelected(deps.selection, cell);
        if (!inSelection) deps.select(cell);
        const cells = inSelection ? selectedCells(deps.selection) : [ cell ];
        const editableCount = cells.filter((c) => deps.isEditable(c.row, c.col)).length;
        const week = cell.col >= deps.leadColumns ? cell.col - deps.leadColumns : null;
        const event = r.kind === "event" ? deps.events[ r.id ] : undefined;
        setMenu({
            actions: gridMenuActions({
                row: r,
                week,
                placedInWeek: week !== null && deps.placedWeeks.has(`${r.id}:${week}`),
                minutesInWeek: week === null ? 0 : r.weekMinutes[ week ] ?? 0,
                expanded: r.kind === "module" ? deps.isModuleExpanded(r.key) : r.kind !== "event" && deps.isSyllabusExpanded(r.key),
                editableSelected: editableCount,
                sharedAcrossShuffles: Boolean(deps.sharedOf(r)) && !event?.groupId && !event?.courseIds?.length,
            }),
            cell,
            position: { top: e.clientY, left: e.clientX },
            rangeSize: editableCount,
            text: (e.currentTarget.textContent ?? "").trim(),
        });
    };

    const runMenuAction = (action: Exclude<GridMenuAction, "set-range">) =>
    {
        if (!menu) return;
        const r = deps.rows[ menu.cell.row ];
        if (!r) return;
        switch (action)
        {
        case "open-dialog": deps.openDialog(r); break;
        case "expand": deps.setExpanded(r, true); break;
        case "collapse": deps.setExpanded(r, false); break;
        case "expand-all-under":
        case "collapse-all-under":
            for (const target of summaryRowsUnder(deps.allRows(), r.key))
                deps.setExpanded(target, action === "expand-all-under");
            break;
        case "edit-week": deps.startEdit(menu.cell.row, menu.cell.col); break;
        case "clear-week": void deps.writeWeek(menu.cell, 0, "keep"); break;
        case "remove-mapping": void deps.writeWeek(menu.cell, 0, "remove"); break;
        case "split-shuffles": void deps.splitShuffles(r.id, r.moduleId, r.sharedShuffles ?? []); break;
        case "copy":
            void navigator.clipboard?.writeText(menu.text).catch(() =>
                enqueueSnackbar("ההעתקה נכשלה", { variant: "error" }));
            break;
        }
    };

    const setRange = async (text: string) =>
    {
        const minutes = parseHoursInput(text);
        if (minutes === null)
        {
            enqueueSnackbar("ערך שעות לא תקין", { variant: "error" });
            return;
        }
        // Sequential: each write may raise its own question (zero, move, split).
        for (const cell of selectedCells(deps.selection).filter((c) => deps.isEditable(c.row, c.col)))
            await deps.writeWeek(cell, minutes);
    };

    return { menu, openMenu, closeMenu: () => setMenu(null), runMenuAction, setRange };
}
