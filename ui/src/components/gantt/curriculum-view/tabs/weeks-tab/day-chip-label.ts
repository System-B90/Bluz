import { formatHours, formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";

/**
 * The weeks-tab day chip (#841). The old "X ש׳ משובץ | נותרו Y ש׳" sentence
 * was truncated in most cells, cutting off the remaining/over amount. The chip
 * now shows the short "scheduled / available" pair, and the full sentence moves
 * to its accessible name and tooltip.
 */
export type DayChipLabel = {
    /** Visible chip text, e.g. "0.3 / 6 ש׳". */
    short: string;
    /** Full sentence for the tooltip and screen readers. */
    full: string;
    /** Scheduled exceeds available: the chip carries a warning icon. */
    over: boolean;
};

export function getDayChipLabel(availableMinutes: number, scheduledMinutes: number): DayChipLabel {
    const remaining = availableMinutes - scheduledMinutes;
    const over = remaining < 0;

    let status: string;
    if (scheduledMinutes === 0 && availableMinutes === 0) status = "סגור";
    else if (scheduledMinutes === 0) status = "פנוי";
    else if (over) status = `חריגה ${formatHoursLabel(-remaining)}`;
    else status = `נותרו ${formatHoursLabel(remaining)}`;

    const short = scheduledMinutes === 0 && availableMinutes === 0
        ? "סגור"
        : `${formatHours(scheduledMinutes)} / ${formatHoursLabel(availableMinutes)}`;

    return {
        short,
        full: `${formatHoursLabel(scheduledMinutes)} משובץ מתוך ${formatHoursLabel(availableMinutes)} | ${status}`,
        over,
    };
}
