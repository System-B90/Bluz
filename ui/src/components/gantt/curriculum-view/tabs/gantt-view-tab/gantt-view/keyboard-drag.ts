/**
 * Name: keyboard-drag.ts
 * Purpose: Keyboard scheduling on the timeline (#808). Space picks a bar up,
 *   Left/Right move it one column (a day, or a week in weekly view) in the
 *   direction pressed, Space drops it and Escape cancels. Instructions and
 *   live announcements are in Hebrew, with names and dates.
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import {
    Announcements,
    ClientRect,
    KeyboardCode,
    KeyboardCoordinateGetter,
    ScreenReaderInstructions,
    UniqueIdentifier,
} from "@dnd-kit/core";

import { DragLabels } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drag-labels";

/** Enter is left alone: it opens the focused bar (#833). */
export const GANTT_KEYBOARD_CODES = {
    start: [ KeyboardCode.Space ],
    cancel: [ KeyboardCode.Esc ],
    end: [ KeyboardCode.Space ],
};

type CellRect = { id: UniqueIdentifier; rect: ClientRect };

/**
 * The cell next to `from` in its row (the cells spanning `rowY`), in the
 * arrow's visual direction (-1 = left, +1 = right). Null at the row's edge.
 */
export function neighbourCell(
    cells: ReadonlyArray<CellRect>,
    from: { left: number; rowY: number },
    direction: -1 | 1,
): CellRect | null
{
    let best: CellRect | null = null;
    for (const cell of cells)
    {
        if (from.rowY < cell.rect.top || from.rowY > cell.rect.top + cell.rect.height) continue;
        const ahead = direction > 0
            ? cell.rect.left > from.left + 1
            : cell.rect.left < from.left - 1;
        if (!ahead) continue;
        if (
            !best ||
            (direction > 0 ? cell.rect.left < best.rect.left : cell.rect.left > best.rect.left)
        )
        {
            best = cell;
        }
    }
    return best;
}

/**
 * Moves the dragged bar to the neighbouring cell of its row. Arrows follow
 * the screen, not the calendar: in RTL, Left is the next day.
 */
export const ganttKeyboardCoordinates: KeyboardCoordinateGetter = (
    event,
    { context, currentCoordinates },
) =>
{
    const direction = event.code === KeyboardCode.Right
        ? 1
        : event.code === KeyboardCode.Left ? -1 : 0;
    // Up/Down would leave the row (another module's cells); stay put.
    if (direction === 0) return currentCoordinates;

    const { droppableRects, droppableContainers, over, collisionRect } = context;
    if (!collisionRect) return currentCoordinates;

    const overRect = over ? droppableRects.get(over.id) : undefined;
    const fromDayCell = Boolean(overRect) && over?.data.current?.targetType !== "remove";
    const rowRect = overRect ?? collisionRect;
    const from = {
        left: fromDayCell && overRect ? overRect.left : collisionRect.left,
        rowY: rowRect.top + rowRect.height / 2,
    };

    const cells: Array<CellRect> = [];
    for (const container of droppableContainers.getEnabled())
    {
        if (container.data.current?.targetType === "remove") continue;
        const rect = droppableRects.get(container.id);
        if (rect) cells.push({ id: container.id, rect });
    }

    const next = neighbourCell(cells, from, direction);
    if (!next) return currentCoordinates;

    // Cell to cell keeps the bar's offset inside its cell (a multi-day bar
    // keeps its span); from the label column, centre it on the first day.
    const dx = fromDayCell
        ? next.rect.left - from.left
        : (next.rect.left + next.rect.width / 2) - (collisionRect.left + collisionRect.width / 2);
    return { x: currentCoordinates.x + dx, y: currentCoordinates.y };
};

export const ganttScreenReaderInstructions: ScreenReaderInstructions = {
    draggable:
        "כדי לשבץ, הקישו רווח להרמת הפריט, חצים ימינה ושמאלה להזזה בין הימים, "
        + "ורווח שוב להנחה. Escape מבטל. Enter פותח את הפריט לעריכה.",
};

type DropData = Record<string, unknown> | undefined;

export function buildGanttAnnouncements(
    labels: DragLabels,
    getDropWarning: (payload: DropData, target: DropData) => null | string,
): Announcements
{
    const nameOf = (data: DropData) => labels.itemName(data as Parameters<DragLabels[ "itemName" ]>[ 0 ]);
    const whereOf = (target: DropData) =>
        target?.targetType === "remove"
            ? "אזור ההסרה מהציר"
            : typeof target?.dayId === "string" ? labels.dayLabel(target.dayId) : "יעד לא ידוע";

    return {
        onDragStart: ({ active }) => `הורם ${nameOf(active.data.current)}.`,
        onDragOver: ({ active, over }) =>
        {
            const name = nameOf(active.data.current);
            if (!over) return `${name} אינו מעל יעד.`;
            const warning = getDropWarning(active.data.current, over.data.current);
            return `${name} מעל ${whereOf(over.data.current)}.${warning ? ` אזהרה: ${warning}.` : ""}`;
        },
        onDragEnd: ({ active, over }) =>
        {
            const name = nameOf(active.data.current);
            return over
                ? `${name} הונח ב${whereOf(over.data.current)}.`
                : `${name} הוחזר למקומו.`;
        },
        onDragCancel: ({ active }) => `הגרירה בוטלה. ${nameOf(active.data.current)} חזר למקומו.`,
    };
}
