import { GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";

/**
 * Right-click menu model for the gantt table (#858). Pure, so which entries a
 * cell offers is testable without rendering the grid; the menu component maps
 * each id onto the same handlers the keyboard uses.
 */
export type GridMenuAction =
    | "clear-week"
    | "collapse-all-under"
    | "collapse"
    | "copy"
    | "edit-week"
    | "expand-all-under"
    | "expand"
    | "open-dialog"
    | "remove-mapping"
    | "set-range"
    | "split-shuffles";

export type GridMenuInput = {
    row: GridRow;
    /** Week index of the clicked cell, or null for title/sum/course columns. */
    week: null | number;
    /** Whether the event keeps a mapping in that week (a kept 0 counts). */
    placedInWeek: boolean;
    /** Minutes allotted in that week. */
    minutesInWeek: number;
    /** Summary rows: currently expanded. */
    expanded: boolean;
    /** Editable week cells in the current selection. */
    editableSelected: number;
    /** The event is one un-tagged event shown in several shuffle sections. */
    sharedAcrossShuffles: boolean;
};

/** Entries in display order; `null` marks a divider. */
export function gridMenuActions(input: GridMenuInput): Array<GridMenuAction | null>
{
    const { row, week, placedInWeek, minutesInWeek, expanded, editableSelected, sharedAcrossShuffles } = input;
    const out: Array<GridMenuAction | null> = [ "open-dialog" ];

    if (row.kind === "event")
    {
        if (week !== null)
        {
            out.push(null, "edit-week");
            if (placedInWeek && minutesInWeek > 0) out.push("clear-week");
            if (placedInWeek) out.push("remove-mapping");
        }
        if (sharedAcrossShuffles) out.push(null, "split-shuffles");
    }
    else if (!row.childless)
    {
        out.push(null, expanded ? "collapse" : "expand", "expand-all-under", "collapse-all-under");
    }

    out.push(null, "copy");
    if (editableSelected > 1) out.push("set-range");
    return out;
}

/**
 * Summary rows at and under `targetKey`, read from a fully opened build so
 * collapsed descendants are included.
 * @param allRows Rows built with every syllabus/shuffle/module open.
 * @param targetKey The right-clicked summary row's key.
 */
export function summaryRowsUnder(allRows: Array<GridRow>, targetKey: string): Array<GridRow>
{
    const start = allRows.findIndex((r) => r.key === targetKey);
    if (start === -1) return [];
    const out = [ allRows[ start ] ];
    for (let i = start + 1; i < allRows.length && allRows[ i ].depth > allRows[ start ].depth; i++)
    {
        if (allRows[ i ].kind !== "event") out.push(allRows[ i ]);
    }
    return out;
}

export const GRID_MENU_LABELS: Record<GridMenuAction, string> = {
    "clear-week": "איפוס השבוע (0 שעות)",
    collapse: "כיווץ",
    "collapse-all-under": "כיווץ הכל מתחת",
    copy: "העתקת ערך",
    "edit-week": "עריכת הזמן המוקצה לשבוע",
    expand: "הרחבה",
    "expand-all-under": "הרחבת הכל מתחת",
    "open-dialog": "פתיחה",
    "remove-mapping": "הסרת השיבוץ מהשבוע",
    "set-range": "הגדרת ערך לכל התאים שנבחרו…",
    "split-shuffles": "פיצול לפי שאפלים",
};
