import dayjs from "dayjs";

import {
    getRecurrenceOccurrenceDayIds,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

/**
 * Pure "cut" planner (#117): expands a curriculum's gantt data into dated,
 * timed schedule-event occurrences. No DB access, no I/O — the caller adapts
 * its own data (Drizzle rows, normalized store, etc.) into `CutPlanInput`.
 */

export type CutPlanDayInput = {
    id: string;
    dayIndex: GanttDayIndex;
};

export type CutPlanWeekInput = {
    id: string;
    /** Day ids in this week, in display order. */
    dayIds: Array<string>;
    /** Whether the trainee was on weekend duty. Defaults to `true` (on duty). */
    weekendDuty?: boolean;
};

export type CutPlanEventInput = {
    id: string;
    title: string;
    recurrence: EventRecurrence;
    minimumDuration: number;
    /** Per-curriculum allocated duration (minutes); falls back to `minimumDuration` when falsy. */
    allocatedDuration: number;
};

export type CutPlanMappingInput = {
    eventId: string;
    dayId: string;
    sortOrder: number;
};

export type CutPlanRecurrenceExceptionInput = {
    eventId: string;
    dayId: string;
};

export type CutPlanInput = {
    startDate: null | string;
    /** Weeks in timeline (junction) order. */
    weeks: Array<CutPlanWeekInput>;
    /** All days referenced by `weeks`, keyed by id. */
    days: Record<string, CutPlanDayInput>;
    events: Array<CutPlanEventInput>;
    /** Event-to-day mappings (`cMDA` rows with an `eventId`). */
    mappings: Array<CutPlanMappingInput>;
    recurrenceExceptions: Array<CutPlanRecurrenceExceptionInput>;
    /** Day-start time for stacking, `"HH:mm"`. */
    dayStartTime: string;
    /**
     * Sunday start time (`"HH:mm"`) when the trainee was home (not on
     * weekend duty). Falls back to `dayStartTime` when omitted.
     */
    weekendHomeStartTime?: string;
};

export type PlannedOccurrence = {
    ganttEventId: string;
    /** ISO date (yyyy-MM-dd) of the occurrence — also the recurrence disambiguator. */
    occurrenceDate: string;
    startTime: Date;
    endTime: Date;
    /** True when this is a recurrence echo rather than the mapped start day. */
    isRecurrenceEcho: boolean;
};

export type CutValidationError =
    | { type: "missing-start-date" }
    | { type: "unmapped-event"; eventId: string; title: string }
    | { type: "unsatisfied-recurrence"; eventId: string; title: string };

export type CutPlan =
    | { ok: false; errors: Array<CutValidationError> }
    | { ok: true; occurrences: Array<PlannedOccurrence> };

function eventDuration(event: CutPlanEventInput): number {
    return event.allocatedDuration || event.minimumDuration;
}

export function planCut(input: CutPlanInput): CutPlan {
    const errors: Array<CutValidationError> = [];

    if (!input.startDate) {
        errors.push({ type: "missing-start-date" });
    }

    const linearDayIds = input.weeks.flatMap((w) => w.dayIds);
    const dayIndexOf = (dayId: string): GanttDayIndex | undefined =>
        input.days[dayId]?.dayIndex;
    const weekIndexOfDay = (dayId: string): number =>
        input.weeks.findIndex((w) => w.dayIds.includes(dayId));

    const mappingsByEvent = new Map<string, Array<CutPlanMappingInput>>();
    for (const mapping of input.mappings) {
        const arr = mappingsByEvent.get(mapping.eventId) ?? [];
        arr.push(mapping);
        mappingsByEvent.set(mapping.eventId, arr);
    }

    const exceptionsByEvent = new Map<string, Set<string>>();
    for (const exception of input.recurrenceExceptions) {
        const set = exceptionsByEvent.get(exception.eventId) ?? new Set<string>();
        set.add(exception.dayId);
        exceptionsByEvent.set(exception.eventId, set);
    }

    const startDayIdByEvent = new Map<string, string>();

    for (const event of input.events) {
        const ownMappings = (mappingsByEvent.get(event.id) ?? [])
            .filter((m) => linearDayIds.includes(m.dayId))
            .sort((a, b) => a.sortOrder - b.sortOrder);

        if (ownMappings.length === 0) {
            errors.push({ type: "unmapped-event", eventId: event.id, title: event.title });
            continue;
        }

        const startDayId = ownMappings[0].dayId;
        startDayIdByEvent.set(event.id, startDayId);

        if (event.recurrence !== EventRecurrence.None) {
            const startWeekIdx = weekIndexOfDay(startDayId);
            if (!isRecurrenceSatisfied(event.recurrence, startWeekIdx)) {
                errors.push({
                    type: "unsatisfied-recurrence",
                    eventId: event.id,
                    title: event.title,
                });
            }
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    // Real date for a day: curriculum start (anchoring week 1's Sunday) plus
    // the week's ordinal offset and the day's weekday offset.
    const dayDate = (dayId: string): dayjs.Dayjs => {
        const weekIdx = weekIndexOfDay(dayId);
        const dow = dayIndexOf(dayId) ?? 0;
        return dayjs(input.startDate as string)
            .startOf("day")
            .add(weekIdx * 7 + dow, "day");
    };

    const parseTime = (time: string): [number, number] => {
        const [ hour, minute ] = time.split(":").map(Number);
        return [ hour ?? 0, minute ?? 0 ];
    };
    const defaultStart = parseTime(input.dayStartTime);
    const weekendHomeStart = parseTime(
        input.weekendHomeStartTime ?? input.dayStartTime,
    );

    const weekByDayId = new Map<string, CutPlanWeekInput>();
    for (const week of input.weeks) {
        for (const dayId of week.dayIds) {
            weekByDayId.set(dayId, week);
        }
    }

    // Sunday after a weekend spent at home (weekendDuty === false) starts
    // later, using `weekendHomeStartTime` instead of the regular day start.
    const startTimeForDay = (dayId: string): [number, number] => {
        const isHomeWeekendSunday =
            dayIndexOf(dayId) === GanttDayIndex.Sunday &&
            weekByDayId.get(dayId)?.weekendDuty === false;
        return isHomeWeekendSunday ? weekendHomeStart : defaultStart;
    };

    type Slot = { eventId: string; isRecurrenceEcho: boolean };
    const slotsByDay = new Map<string, Array<Slot>>();
    const pushSlot = (dayId: string, slot: Slot) => {
        const arr = slotsByDay.get(dayId) ?? [];
        arr.push(slot);
        slotsByDay.set(dayId, arr);
    };

    // Own mapped days first, ordered by sortOrder.
    const ownMappingsSorted = [ ...input.mappings ]
        .filter((m) => linearDayIds.includes(m.dayId))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const mapping of ownMappingsSorted) {
        pushSlot(mapping.dayId, { eventId: mapping.eventId, isRecurrenceEcho: false });
    }

    // Recurrence echoes land after a day's own events, ordered by title.
    const echoesByDay = new Map<string, Array<{ eventId: string; title: string }>>();
    for (const event of input.events) {
        if (event.recurrence === EventRecurrence.None) continue;
        const startDayId = startDayIdByEvent.get(event.id);
        if (!startDayId) continue;

        const echoDayIds = getRecurrenceOccurrenceDayIds({
            recurrence: event.recurrence,
            startDayId,
            linearDays: linearDayIds,
            dayIndexOf,
            excludedDayIds: exceptionsByEvent.get(event.id),
        });

        for (const dayId of echoDayIds) {
            const arr = echoesByDay.get(dayId) ?? [];
            arr.push({ eventId: event.id, title: event.title });
            echoesByDay.set(dayId, arr);
        }
    }
    for (const [ dayId, echoes ] of echoesByDay) {
        echoes.sort((a, b) => a.title.localeCompare(b.title));
        for (const echo of echoes) {
            pushSlot(dayId, { eventId: echo.eventId, isRecurrenceEcho: true });
        }
    }

    const eventsById = new Map(input.events.map((e) => [ e.id, e ]));
    const occurrences: Array<PlannedOccurrence> = [];

    for (const [ dayId, slots ] of slotsByDay) {
        const date = dayDate(dayId);
        const [ startHour, startMinute ] = startTimeForDay(dayId);
        let cursor = date.hour(startHour).minute(startMinute).second(0).millisecond(0);

        for (const slot of slots) {
            const event = eventsById.get(slot.eventId);
            if (!event) continue;

            const duration = eventDuration(event);
            const startTime = cursor;
            const endTime = cursor.add(duration, "minute");

            occurrences.push({
                ganttEventId: event.id,
                occurrenceDate: date.format("YYYY-MM-DD"),
                startTime: startTime.toDate(),
                endTime: endTime.toDate(),
                isRecurrenceEcho: slot.isRecurrenceEcho,
            });

            cursor = endTime;
        }
    }

    return { ok: true, occurrences };
}
