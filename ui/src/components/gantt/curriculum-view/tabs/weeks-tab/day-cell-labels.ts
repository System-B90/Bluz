/** Accessible names for a weeks-tab day cell's controls (#842). */
export function dayHoursStepLabel(direction: "down" | "up", dayName: string, dateLabel: string): string {
    const action = direction === "up" ? "הגדלת שעות" : "הקטנת שעות";
    return `${action} — יום ${dayName}${dateLabel ? ` ${dateLabel}` : ""}`;
}

export function dayHoursInputLabel(dayName: string, dateLabel: string): string {
    return `שעות עבודה — יום ${dayName}${dateLabel ? ` ${dateLabel}` : ""}`;
}

/**
 * The +/− buttons appear on hover, and on keyboard focus anywhere in the cell
 * (#842): before, they were opacity 0 yet still tabbable.
 */
export const REVEAL_ON_HOVER_OR_FOCUS = [ ".group\\/cell:hover &", ".group\\/cell:focus-within &" ].join(", ");
