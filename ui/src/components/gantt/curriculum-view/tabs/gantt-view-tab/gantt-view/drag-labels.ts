/**
 * Name: drag-labels.ts
 * Purpose: Hebrew wording for timeline drags: what is being dragged, which
 *   day it lands on, and what happened. Shared by the drop snackbars (#810),
 *   undo/redo (#809) and the screen-reader announcements (#808).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import dayjs from "dayjs";

import { getDayNameDisplay, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { formatShortDate } from "@/components/gantt/curriculum-view/gantt-time-utils";

export type DragLabels = {
    /** Quoted title of the dragged module or event. */
    itemName: (item: { moduleId?: string; eventId?: null | string } | undefined) => string;
    /** "יום שני 3.8" (date omitted when the curriculum has no start date). */
    dayLabel: (dayId: string) => string;
};

type LabelSources = {
    modules: Readonly<Record<string, { title?: string } | undefined>>;
    events: Readonly<Record<string, { title?: string } | undefined>>;
    days: Readonly<Record<string, { dayIndex: GanttDayIndex } | undefined>>;
    dateOfDayId: (dayId: string) => string | undefined;
};

export function buildDragLabels({ modules, events, days, dateOfDayId }: LabelSources): DragLabels
{
    return {
        itemName: (item) =>
        {
            const title = item?.eventId
                ? events[ item.eventId ]?.title
                : item?.moduleId ? modules[ item.moduleId ]?.title : undefined;
            return `"${title ?? (item?.eventId ? "מפגש" : "מערך")}"`;
        },
        dayLabel: (dayId) =>
        {
            const day = days[ dayId ];
            const name = day ? `יום ${getDayNameDisplay(day.dayIndex)}` : "יום";
            const date = dateOfDayId(dayId);
            return date ? `${name} ${formatShortDate(dayjs(date))}` : name;
        },
    };
}

export const dropMessages = {
    placed: (name: string, day: string) => `${name} שובץ ל${day}`,
    moved: (name: string, day: string) => `${name} הועבר ל${day}`,
    removed: (name: string) => `${name} הוסר מהציר`,
    occurrenceRemoved: (name: string, day: string) => `מופע של ${name} ב${day} הוסר`,
    shiftRefused: (name: string) => `לא ניתן להזיז את ${name} — מופעים יחרגו מסוף הציר`,
    failed: "השיבוץ נכשל!",
};
