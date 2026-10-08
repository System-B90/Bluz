/**
 * Frozen leading columns of the gantt table (#913): the course columns, the
 * title, and the required/allocated hours stay put while the weeks scroll
 * sideways beneath them, the way the header rows stay put vertically.
 */
export type FrozenColumns = {
    /** Inline-start offset (px) of each frozen column, in column order. */
    offsets: Array<number>;
    /** Total width (px) of the frozen block; the weeks scroll under it. */
    width: number;
};

export type FrozenColumnWidths = {
    courseCount: number;
    courseWidth: number;
    /** The title column's rendered width; it fills the remaining space, so it is measured. */
    titleWidth: number;
    /** Leading columns after the courses: title plus the hour columns. */
    leadColumns: number;
    hoursWidth: number;
};

export function frozenColumns({
    courseCount,
    courseWidth,
    titleWidth,
    leadColumns,
    hoursWidth,
}: FrozenColumnWidths): FrozenColumns {
    const widths = [
        ...Array.from({ length: courseCount }, () => courseWidth),
        titleWidth,
        ...Array.from({ length: leadColumns - 1 }, () => hoursWidth),
    ];
    const offsets: Array<number> = [];
    let width = 0;
    for (const w of widths) {
        offsets.push(width);
        width += w;
    }
    return { offsets, width };
}
