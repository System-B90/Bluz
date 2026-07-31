import dayjs from "dayjs";

import {
    getRecurrenceOccurrenceDayIds,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";

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
    /** Preferred meal times (`"HH:mm"`), blocked out as breaks during stacking. Any subset may be omitted. */
    breakfastTime?: string;
    lunchTime?: string;
    dinnerTime?: string;
};

/** Meal break length (minutes) blocked out around each configured meal time. */
export const MEAL_BREAK_DURATION_MINUTES = 30;

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

export type CutPlanOptions = {
    /**
     * When true, an unmapped event or an unsatisfied recurrence no longer
     * fails the whole plan — the offending event is dropped and planning
     * continues. Lets a user explicitly cut an unfinished gantt. A missing
     * start date is still fatal (nothing is datable without it).
     */
    force?: boolean;
};

export function planCut(input: CutPlanInput, options: CutPlanOptions = {}): CutPlan {
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
    const skippedEventIds = new Set<string>();

    for (const event of input.events) {
        const ownMappings = (mappingsByEvent.get(event.id) ?? [])
            .filter((m) => linearDayIds.includes(m.dayId))
            .sort((a, b) => a.sortOrder - b.sortOrder);

        if (ownMappings.length === 0) {
            errors.push({ type: "unmapped-event", eventId: event.id, title: event.title });
            skippedEventIds.add(event.id);
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
                skippedEventIds.add(event.id);
            }
        }
    }

    const fatalErrors = options.force
        ? errors.filter((error) => error.type === "missing-start-date")
        : errors;
    if (fatalErrors.length > 0) {
        return { ok: false, errors: fatalErrors };
    }
    if (options.force && skippedEventIds.size > 0) {
        input = { ...input, events: input.events.filter((e) => !skippedEventIds.has(e.id)) };
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

    // Auto-seeded meal events (titles from MEAL_EVENT_TITLES) are pinned to
    // their exact clock time from settings instead of being stacked; every
    // other event gets bumped past that window instead of overlapping it.
    const fixedTimeMinutesByEventId = new Map<string, number>();
    for (const [ settingKey, title ] of Object.entries(MEAL_EVENT_TITLES)) {
        const time = input[ settingKey as keyof typeof MEAL_EVENT_TITLES ];
        if (!time) continue;
        const matchedEvent = input.events.find((e) => e.title === title);
        if (!matchedEvent) continue;
        const [ hour, minute ] = parseTime(time);
        fixedTimeMinutesByEventId.set(matchedEvent.id, hour * 60 + minute);
    }

    const occurrences: Array<PlannedOccurrence> = [];

    for (const [ dayId, slots ] of slotsByDay) {
        const date = dayDate(dayId);
        const [ startHour, startMinute ] = startTimeForDay(dayId);
        let cursor = date.hour(startHour).minute(startMinute).second(0).millisecond(0);

        // Only block out windows for meal events actually present on this
        // day (a recurrence exception may skip a meal event for one day) —
        // other days without a matching event stack normally, unaffected.
        const slottedEventIds = new Set(slots.map((s) => s.eventId));
        const mealWindows: Array<{ startMinutes: number; endMinutes: number }> = [
            ...fixedTimeMinutesByEventId.entries(),
        ]
            .filter(([ eventId ]) => slottedEventIds.has(eventId))
            .map(([ eventId, startMinutes ]) => {
                const event = eventsById.get(eventId);
                const duration = event ? eventDuration(event) : MEAL_BREAK_DURATION_MINUTES;
                return { startMinutes, endMinutes: startMinutes + duration };
            })
            .sort((a, b) => a.startMinutes - b.startMinutes);

        for (const slot of slots) {
            const event = eventsById.get(slot.eventId);
            if (!event) continue;

            const duration = eventDuration(event);
            const fixedStartMinutes = fixedTimeMinutesByEventId.get(event.id);

            let startTime: dayjs.Dayjs;
            let endTime: dayjs.Dayjs;

            if (fixedStartMinutes !== undefined) {
                // Pinned meal event: placed at its configured clock time,
                // independent of and without consuming the stacking cursor.
                startTime = date
                    .hour(Math.floor(fixedStartMinutes / 60))
                    .minute(fixedStartMinutes % 60)
                    .second(0)
                    .millisecond(0);
                endTime = startTime.add(duration, "minute");
            } else {
                // Bump the cursor past any meal window it would otherwise overlap.
                for (const window of mealWindows) {
                    const cursorMinutes = cursor.hour() * 60 + cursor.minute();
                    const eventEndMinutes = cursorMinutes + duration;
                    if (cursorMinutes < window.endMinutes && eventEndMinutes > window.startMinutes) {
                        cursor = date
                            .hour(Math.floor(window.endMinutes / 60))
                            .minute(window.endMinutes % 60)
                            .second(0)
                            .millisecond(0);
                    }
                }

                startTime = cursor;
                endTime = cursor.add(duration, "minute");
                cursor = endTime;
            }

            occurrences.push({
                ganttEventId: event.id,
                occurrenceDate: date.format("YYYY-MM-DD"),
                startTime: startTime.toDate(),
                endTime: endTime.toDate(),
                isRecurrenceEcho: slot.isRecurrenceEcho,
            });
        }
    }

    return { ok: true, occurrences };
}
