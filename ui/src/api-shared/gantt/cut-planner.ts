import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import {
    BalancerSlot,
    balanceWeeks,
    SpillMove,
    WeekOverflow,
} from "@/api-shared/gantt/cut-balancer";
import {
    GeneratedBreak,
    insertBreaksForDay,
    PlacedItem,
    PrayerWindow,
} from "@/api-shared/gantt/cut-breaks";
import {
    ConstraintDayInfo,
    ConstraintMoveProposal,
    ConstraintPlacement,
    ConstraintViolation,
    solveConstraints,
} from "@/api-shared/gantt/cut-constraints";
import {
    CAPACITY_RULES,
    OVERFLOW_RULES,
    PRAYER_RULES,
    WeekOverflowResolution,
} from "@/api-shared/gantt/cut-rules";
import {
    getRecurrenceOccurrenceDayIds,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { layoutAroundWindows, layoutEnd } from "@/api-shared/interval-layout";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import {
    GanttConstraint,
    getAllowedDayIndices,
} from "@/api-shared/types/gantt/models/constraint";
import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";

/**
 * Pure "cut" planner (#117): expands a curriculum's gantt data into dated,
 * timed schedule-event occurrences. No DB access, no I/O — the caller adapts
 * its own data (Drizzle rows, normalized store, etc.) into `CutPlanInput`.
 */

export type CutPlanDayInput = {
    id: string;
    dayIndex: GanttDayIndex;
    /** Configured working minutes for this day; the fallback for a null end time. */
    totalWorkingMinutes?: number;
    /**
     * Explicit end of this day's working window (`"HH:mm"`). Null/absent ⇒
     * derived as the day's start time plus `totalWorkingMinutes`, which is how
     * days behaved before the field existed.
     */
    dayEndTime?: null | string;
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
    /** Recurrence window bounds ("YYYY-MM-DD"); null/absent ⇒ unbounded (#468). */
    recurrenceStartDate?: null | string;
    recurrenceEndDate?: null | string;
    /**
     * When true, an overlapping meal/break window splits this event instead
     * of bumping it past the window: runs up to the window's start, resumes
     * after it ends (end time pushed out by the window's length).
     */
    splitAcrossBreaks: boolean;
    /** Drives the break rules (long ע"ע runs, post-lecture, prayer avoidance). */
    type?: ModuleEventType;
    /** Owning gantt module — drives module cohesion during spillover. */
    moduleId?: null | string;
    /** Owning syllabus — drives the between-syllabuses break rule. */
    syllabusId?: null | string;
    /** Assigned room name once the cut assigns rooms; null today. */
    roomName?: null | string;
    /** Constraints owned by this event. */
    constraints?: Array<GanttConstraint>;
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
    /**
     * Prayer windows (`"HH:mm"` starts) read from the schedule settings by the
     * server and handed in here — the pure planner has no way to reach Mongo.
     * Soft windows: breaks prefer to cover them, lectures prefer to avoid them,
     * and neither ever extends a day. See `PRAYER_RULES`.
     */
    prayerTimes?: Array<{ name: string; time: string; durationMinutes?: number }>;
    /** Constraints owned by gantt modules, fanned out to their events. */
    moduleConstraints?: Array<{
        moduleId: string;
        title: string;
        constraints: Array<GanttConstraint>;
    }>;
    /** Module id → the event ids it contains, for module-level constraints. */
    eventIdsByModule?: Record<string, Array<string>>;
};

/**
 * Synthetic `ganttEventId` prefix for breaks the post-pass generated. They are
 * real schedule events with no gantt event behind them; the prefix marks their
 * provenance so a pull-back archives them with the rest of the cut and a
 * re-cut never duplicates them.
 */
export const GENERATED_BREAK_EVENT_ID_PREFIX = "cut-break:";

/** True for a `ganttEventId` the break post-pass invented. */
export function isGeneratedBreakEventId(ganttEventId: string): boolean {
    return ganttEventId.startsWith(GENERATED_BREAK_EVENT_ID_PREFIX);
}

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
    /**
     * Set when the balancer relocated this occurrence off the day it was mapped
     * to — the id of that original day. Drives the preview's moved/unmoved
     * highlight.
     */
    spilledFromDayId?: string;
    /**
     * Set on occurrences the break post-pass generated rather than the gantt.
     * These are real הפסקה events in the schedule, tagged so a pull-back
     * archives them alongside everything else the cut created.
     */
    generatedBreak?: {
        kind: string;
        title: string;
        /** Prayer this break was positioned to cover, when any. */
        coversPrayer: null | string;
    };
};

/**
 * A question the cut could not answer on its own. The dialog walks these one at
 * a time rather than presenting a switchboard, and sends the answers back with
 * the commit. See `docs/gantt-cut-rules.md`.
 */
export type CutDecision =
    | {
          type: "constraint-moves";
          proposals: Array<ConstraintMoveProposal>;
      }
    | {
          type: "constraint-violation";
          violation: ConstraintViolation;
      }
    | {
          type: "week-overflow";
          weekId: string;
          /** 1-based week number, for the Hebrew prompt. */
          weekNumber: number;
          excessMinutes: number;
          overloadedDays: Array<{ dayId: string; overflowMinutes: number }>;
      };

export type CutValidationError =
    | { type: "missing-start-date" }
    | { type: "unmapped-event"; eventId: string; title: string }
    | { type: "unsatisfied-recurrence"; eventId: string; title: string };

/**
 * One relocated slot, described in terms a user can read: which event moved,
 * from which date to which. A slot the balancer bounced twice (off ראשון, then
 * off שני) collapses into a single detail spanning its first and last day.
 */
export type CutSpillDetail = {
    slotKey: string;
    eventId: string;
    /** Event title at plan time; falls back to the id for generated slots. */
    title: string;
    fromDayId: string;
    toDayId: string;
    /** ISO date (yyyy-MM-dd) the slot was originally mapped to. */
    fromDate: string;
    /** ISO date (yyyy-MM-dd) it ended up on. */
    toDate: string;
    durationMinutes: number;
};

/** Everything the balancer and the break pass did, for the preview and dialog. */
export type CutPlanReport = {
    /** Occurrences the balancer relocated to a later day in the same week. */
    moves: Array<SpillMove>;
    /** The same relocations, resolved to titles and dates for display. */
    spills: Array<CutSpillDetail>;
    /** Weeks that still exceed their working hours after balancing. */
    overflows: Array<WeekOverflow>;
    /** Breaks the post-pass inserted, keyed to the day they landed on. */
    breaks: Array<GeneratedBreak & { dayId: string; occurrenceDate: string }>;
    /** Cross-day moves the constraint solver would like to make. */
    constraintProposals: Array<ConstraintMoveProposal>;
    /** Constraints no legal placement satisfies. */
    constraintViolations: Array<ConstraintViolation>;
    /** Open questions for the dialog, in the order they should be asked. */
    decisions: Array<CutDecision>;
};

export type CutPlan =
    | { ok: false; errors: Array<CutValidationError> }
    | {
          ok: true;
          occurrences: Array<PlannedOccurrence>;
          report: CutPlanReport;
      };

function eventDuration(event: CutPlanEventInput): number {
    return event.allocatedDuration || event.minimumDuration;
}

const MINUTES_PER_DAY = 24 * 60;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** `date` (`YYYY-MM-DD`) shifted by whole days, timezone-free. */
function shiftDate(date: string, days: number): string {
    return dayjs.utc(date).add(days, "day").format("YYYY-MM-DD");
}

/**
 * That calendar day at a given minute-of-day offset, as an instant anchored in
 * the venue timezone (#415).
 *
 * The day is carried around as a bare `YYYY-MM-DD` string rather than a Dayjs
 * object on purpose: building the wall clock from scratch through `dayjs.tz`
 * keeps every occurrence DST-correct, whereas `.hour()/.minute()` on a
 * tz-anchored object reuses the offset that object was created with.
 */
function minutesOfDay(date: string, minutes: number): dayjs.Dayjs {
    // A meal window can end past midnight, so normalize the overflow onto the
    // following calendar day instead of emitting an out-of-range hour.
    const dayOffset = Math.floor(minutes / MINUTES_PER_DAY);
    const withinDay = minutes - dayOffset * MINUTES_PER_DAY;
    return dayjs.tz(
        `${shiftDate(date, dayOffset)}T${pad2(Math.floor(withinDay / 60))}:${pad2(withinDay % 60)}:00`,
        APP_TIMEZONE,
    );
}

export type CutPlanOptions = {
    /**
     * When true, an unmapped event or an unsatisfied recurrence no longer
     * fails the whole plan — the offending event is dropped and planning
     * continues. Lets a user explicitly cut an unfinished gantt. A missing
     * start date is still fatal (nothing is datable without it).
     */
    force?: boolean;
    /**
     * Auto-spillover: rebalance each week so no day carries more than its
     * working window, cascading work forward within the week. Defaults to on —
     * pass `false` for the pre-#… raw stacking behaviour.
     */
    autoSpillover?: boolean;
    /**
     * Break post-pass: spread a day's leftover slack through the day as real
     * הפסקה events instead of leaving it as an empty tail. Defaults to on.
     */
    insertBreaks?: boolean;
    /**
     * Constraint-solver moves the user accepted, by event id. Proposals not
     * listed here are reported but not applied — the cut never silently moves
     * an event the user mapped deliberately.
     */
    acceptedConstraintMoves?: Array<string>;
    /**
     * Per-week answer to a `week-overflow` decision. Absent weeks use
     * `OVERFLOW_RULES.defaultResolution` (`overlap-source`).
     */
    weekOverflowResolutions?: Record<string, WeekOverflowResolution>;
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
    // the week's ordinal offset and the day's weekday offset. Kept as a bare
    // `YYYY-MM-DD` string — the clock time is attached later, in the venue
    // timezone, by `minutesOfDay` (#415).
    const dayDate = (dayId: string): string => {
        const weekIdx = weekIndexOfDay(dayId);
        const dow = dayIndexOf(dayId) ?? 0;
        return shiftDate(input.startDate as string, weekIdx * 7 + dow);
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
            recurrenceStartDate: event.recurrenceStartDate,
            recurrenceEndDate: event.recurrenceEndDate,
            dateOf: dayDate,
            allowedDayIndices: getAllowedDayIndices(event.constraints),
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
    // A curriculum may hold several same-titled meal events rather than one
    // Daily-recurrence event (imported data pre-dating the single-event seed) —
    // every matching event is pinned, not just the first.
    const fixedTimeMinutesByEventId = new Map<string, number>();
    for (const [ settingKey, title ] of Object.entries(MEAL_EVENT_TITLES)) {
        const time = input[ settingKey as keyof typeof MEAL_EVENT_TITLES ];
        if (!time) continue;
        const matchedEvents = input.events.filter((e) => e.title === title);
        if (matchedEvents.length === 0) continue;
        const [ hour, minute ] = parseTime(time);
        for (const matchedEvent of matchedEvents) {
            fixedTimeMinutesByEventId.set(matchedEvent.id, hour * 60 + minute);
        }
    }

    const startMinutesOf = (dayId: string): number => {
        const [ hour, minute ] = startTimeForDay(dayId);
        return hour * 60 + minute;
    };

    /**
     * Whether a day declares a working window at all. A day with neither an
     * explicit `dayEndTime` nor any configured `totalWorkingMinutes` has no
     * capacity the user ever stated, and the cut refuses to invent one for it:
     * such a day is unbounded, stacks exactly as it always did, and is never
     * balanced, wrapped or break-filled.
     */
    const hasDeclaredWindow = (dayId: string): boolean => {
        const day = input.days[ dayId ];
        return Boolean(day?.dayEndTime) || (day?.totalWorkingMinutes ?? 0) > 0;
    };

    /**
     * End of a day's working window, in minutes-of-day. An explicit
     * `dayEndTime` wins; otherwise it is derived as the day's start plus its
     * configured `totalWorkingMinutes`, which reproduces exactly how days
     * behaved before the field existed. An undeclared day falls back to
     * `CAPACITY_RULES.fallbackDayEndTime`, which is only ever read for display
     * — `hasDeclaredWindow` gates every rule that would act on it.
     */
    const endMinutesOf = (dayId: string): number => {
        const day = input.days[ dayId ];
        if (day?.dayEndTime) {
            const [ hour, minute ] = parseTime(day.dayEndTime);
            return hour * 60 + minute;
        }
        if (day?.totalWorkingMinutes) {
            return startMinutesOf(dayId) + day.totalWorkingMinutes;
        }
        const [ hour, minute ] = parseTime(CAPACITY_RULES.fallbackDayEndTime);
        return hour * 60 + minute;
    };

    /** Minutes between a day's start and end — the capacity rules pack into. */
    const capacityOf = (dayId: string): number =>
        Math.max(0, endMinutesOf(dayId) - startMinutesOf(dayId));

    // ---------------------------------------------------------------------
    // Balance: spill over-full days forward within their own week.
    // ---------------------------------------------------------------------

    const balancerSlotsByDay = new Map<string, Array<BalancerSlot>>();
    const originalDayIdBySlotKey = new Map<string, string>();
    for (const [ dayId, daySlots ] of slotsByDay) {
        const built = daySlots.map((slot, ordinal) => {
            const event = eventsById.get(slot.eventId);
            const key = `${slot.eventId}@${dayId}#${ordinal}`;
            originalDayIdBySlotKey.set(key, dayId);
            return {
                key,
                eventId: slot.eventId,
                durationMinutes: event ? eventDuration(event) : 0,
                moduleId: event?.moduleId ?? null,
                isRecurrenceEcho: slot.isRecurrenceEcho,
                isDailyRecurrence: event?.recurrence === EventRecurrence.Daily,
                isPinnedMeal: fixedTimeMinutesByEventId.has(slot.eventId),
                sortOrder: ordinal,
            } satisfies BalancerSlot;
        });
        balancerSlotsByDay.set(dayId, built);
    }

    // Only days that declare a working window take part in balancing. An
    // undeclared day states no limit to exceed and no room to offer, so it is
    // neither a spill source nor a spill target — it stacks as it always did.
    const balancerDays = Object.fromEntries(
        Object.values(input.days)
            .filter((day) => hasDeclaredWindow(day.id))
            .map((day) => [
                day.id,
                {
                    id: day.id,
                    dayIndex: day.dayIndex,
                    capacityMinutes: capacityOf(day.id),
                },
            ]),
    );

    const autoSpillover = options.autoSpillover ?? true;
    const balanced = autoSpillover
        ? balanceWeeks({
            weeks: input.weeks.map((week) => ({ id: week.id, dayIds: week.dayIds })),
            days: balancerDays,
            slotsByDay: balancerSlotsByDay,
        })
        : { slotsByDay: balancerSlotsByDay, moves: [], overflows: [] };

    let placedSlotsByDay = balanced.slotsByDay;

    // ---------------------------------------------------------------------
    // Constraints: reorder within a day, and propose cross-day moves.
    // ---------------------------------------------------------------------

    const dayOrdinalById = new Map(linearDayIds.map((dayId, index) => [ dayId, index ]));
    const weekIdOfDay = (dayId: string): string =>
        weekByDayId.get(dayId)?.id ?? "";

    const constraintDays: Record<string, ConstraintDayInfo> = {};
    for (const dayId of linearDayIds) {
        const day = input.days[ dayId ];
        // Same rule as the balancer: the solver may not move work onto a day
        // whose capacity nobody declared.
        if (!day || !hasDeclaredWindow(dayId)) continue;
        constraintDays[ dayId ] = {
            id: dayId,
            dayIndex: day.dayIndex,
            weekId: weekIdOfDay(dayId),
            dayOrdinal: dayOrdinalById.get(dayId) ?? 0,
            capacityMinutes: capacityOf(dayId),
            loadMinutes: (placedSlotsByDay.get(dayId) ?? []).reduce(
                (sum, slot) => sum + slot.durationMinutes,
                0,
            ),
        };
    }

    const constraintPlacements: Array<ConstraintPlacement> = [];
    for (const [ dayId, daySlots ] of placedSlotsByDay) {
        for (const slot of daySlots) {
            if (slot.isRecurrenceEcho || slot.isPinnedMeal) continue;
            const day = input.days[ dayId ];
            if (!day) continue;
            constraintPlacements.push({
                eventId: slot.eventId,
                moduleId: slot.moduleId,
                dayId,
                dayOrdinal: dayOrdinalById.get(dayId) ?? 0,
                dayIndex: day.dayIndex,
                weekId: weekIdOfDay(dayId),
                durationMinutes: slot.durationMinutes,
            });
        }
    }

    const constraintOutcome = solveConstraints({
        placements: constraintPlacements,
        days: constraintDays,
        entities: [
            ...input.events
                .filter((event) => (event.constraints ?? []).length > 0)
                .map((event) => ({
                    id: event.id,
                    title: event.title,
                    constraints: event.constraints ?? [],
                })),
            ...(input.moduleConstraints ?? []).map((module) => ({
                id: module.moduleId,
                title: module.title,
                constraints: module.constraints,
            })),
        ],
        eventIdsByModule: input.eventIdsByModule ?? {},
        titleByEventId: Object.fromEntries(
            input.events.map((event) => [ event.id, event.title ]),
        ),
    });

    // Only moves the caller explicitly accepted are applied; the rest are
    // reported so the dialog can ask about them one at a time.
    const acceptedMoves = new Set(options.acceptedConstraintMoves ?? []);
    if (acceptedMoves.size > 0) {
        const relocated = new Map(placedSlotsByDay);
        for (const proposal of constraintOutcome.proposals) {
            if (!acceptedMoves.has(proposal.eventId)) continue;
            const from = relocated.get(proposal.fromDayId) ?? [];
            const moving = from.filter(
                (slot) => slot.eventId === proposal.eventId && !slot.isRecurrenceEcho,
            );
            if (moving.length === 0) continue;
            relocated.set(
                proposal.fromDayId,
                from.filter((slot) => !moving.includes(slot)),
            );
            relocated.set(proposal.toDayId, [
                ...(relocated.get(proposal.toDayId) ?? []),
                ...moving,
            ]);
        }
        for (const [ dayId, daySlots ] of relocated) {
            relocated.set(
                dayId,
                [ ...daySlots ].sort((a, b) => a.sortOrder - b.sortOrder),
            );
        }
        placedSlotsByDay = relocated;
    }

    // ---------------------------------------------------------------------
    // Materialize: give every slot a clock time inside its day.
    // ---------------------------------------------------------------------

    const prayerWindows: Array<PrayerWindow> = (input.prayerTimes ?? []).map(
        (prayer) => {
            const [ hour, minute ] = parseTime(prayer.time);
            const startMinutes = hour * 60 + minute;
            return {
                name: prayer.name,
                startMinutes,
                endMinutes:
                    startMinutes +
                    (prayer.durationMinutes ?? PRAYER_RULES.defaultDurationMinutes),
            };
        },
    );

    const occurrences: Array<PlannedOccurrence> = [];
    const reportedBreaks: CutPlanReport["breaks"] = [];

    for (const [ dayId, daySlots ] of placedSlotsByDay) {
        if (daySlots.length === 0) continue;
        const date = dayDate(dayId);
        const dayStartMinutes = startMinutesOf(dayId);
        const dayEndMinutes = endMinutesOf(dayId);
        let cursor = dayStartMinutes;

        // How this day handles work that does not fit its window. `extend-day`
        // is the only resolution that lets the stack run past the end time;
        // every other one keeps the day inside its hours and overlaps instead.
        const resolution: WeekOverflowResolution =
            options.weekOverflowResolutions?.[ weekIdOfDay(dayId) ] ??
            OVERFLOW_RULES.defaultResolution;
        // An undeclared day has no window to stay inside, so the wrap never
        // applies to it — it stacks exactly as it always did.
        const mayExtendDay =
            resolution === "extend-day" || !hasDeclaredWindow(dayId);
        // Overflowing events restart from the day's start, stacking as a second
        // (third, …) overlapping layer rather than spilling past the end time.
        let overlapCursor = dayStartMinutes;

        // Only block out windows for meal events actually present on this
        // day (a recurrence exception may skip a meal event for one day) —
        // other days without a matching event stack normally, unaffected.
        const slottedEventIds = new Set(daySlots.map((s) => s.eventId));
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

        const placed: Array<PlacedItem & { slot: BalancerSlot }> = [];

        for (const slot of daySlots) {
            const event = eventsById.get(slot.eventId);
            if (!event) continue;

            const duration = eventDuration(event);
            const fixedStartMinutes = fixedTimeMinutesByEventId.get(event.id);

            let startMinutes: number;

            if (fixedStartMinutes !== undefined) {
                // Pinned meal event: placed at its configured clock time,
                // independent of and without consuming the stacking cursor.
                startMinutes = fixedStartMinutes;
            } else if (event.splitAcrossBreaks) {
                // The event runs through the meal windows in pieces instead of
                // being bumped past them. Only the *net* span is recorded —
                // the pieces are a rendering concern — but the stacking cursor
                // must clear the last piece so the next event doesn't land on
                // top of it.
                const pieces = layoutAroundWindows(
                    cursor * 60_000,
                    duration * 60_000,
                    mealWindows.map((window) => ({
                        start: window.startMinutes * 60_000,
                        end: window.endMinutes * 60_000,
                    })),
                );
                // A cursor sitting inside a window is pushed out by the layout,
                // so the first piece — not the cursor — is the real start.
                startMinutes = pieces[ 0 ].start / 60_000;
                cursor = layoutEnd(pieces) / 60_000;
            } else {
                // Bump the cursor past any meal window it would otherwise
                // overlap. A bump that would carry the event past midnight is
                // refused (#474): overlapping the break is the lesser wrong —
                // it stays on the right day and is visible in the schedule, so
                // the user can resolve it deliberately.
                for (const window of mealWindows) {
                    if (
                        cursor < window.endMinutes &&
                        cursor + duration > window.startMinutes
                    ) {
                        if (window.endMinutes + duration > MINUTES_PER_DAY) continue;
                        cursor = window.endMinutes;
                    }
                }
                startMinutes = cursor;
                cursor = startMinutes + duration;

                // The day is full. Rather than run past its end time — which
                // the cut never does — wrap back to the day's start and let
                // this event overlap what is already there. It stays visible,
                // on the right day, for the user to resolve deliberately.
                if (!mayExtendDay && startMinutes + duration > dayEndMinutes) {
                    startMinutes = overlapCursor;
                    overlapCursor = startMinutes + duration;
                    if (overlapCursor > dayEndMinutes) {
                        overlapCursor = dayStartMinutes;
                    }
                    cursor = dayEndMinutes;
                }
            }

            placed.push({
                slot,
                key: slot.key,
                startMinutes,
                endMinutes: startMinutes + duration,
                eventType: event.type ?? ModuleEventType.Other,
                syllabusId: event.syllabusId ?? null,
                roomName: event.roomName ?? null,
                isExistingBreak: fixedStartMinutes !== undefined,
                isPinned: fixedStartMinutes !== undefined,
            });
        }

        // -----------------------------------------------------------------
        // Break post-pass: spread the day's leftover slack through the day.
        // -----------------------------------------------------------------
        let finalItems: Array<PlacedItem> = placed;
        let generatedBreaks: Array<GeneratedBreak> = [];
        // No declared window means no slack to spread: the break pass would be
        // budgeting against a number the user never set.
        if ((options.insertBreaks ?? true) && hasDeclaredWindow(dayId)) {
            const pass = insertBreaksForDay({
                items: placed,
                dayEndMinutes: endMinutesOf(dayId),
                prayers: prayerWindows,
            });
            finalItems = pass.items;
            generatedBreaks = pass.breaks;
        }

        const slotByKey = new Map(placed.map((item) => [ item.key, item.slot ]));
        for (const item of finalItems) {
            const slot = slotByKey.get(item.key);
            if (!slot) continue;
            const originalDayId = originalDayIdBySlotKey.get(slot.key);
            occurrences.push({
                ganttEventId: slot.eventId,
                occurrenceDate: date,
                startTime: minutesOfDay(date, item.startMinutes).toDate(),
                endTime: minutesOfDay(date, item.endMinutes).toDate(),
                isRecurrenceEcho: slot.isRecurrenceEcho,
                ...(originalDayId && originalDayId !== dayId
                    ? { spilledFromDayId: originalDayId }
                    : {}),
            });
        }

        for (const generated of generatedBreaks) {
            occurrences.push({
                ganttEventId: `${GENERATED_BREAK_EVENT_ID_PREFIX}${dayId}:${generated.afterItemKey}`,
                occurrenceDate: date,
                startTime: minutesOfDay(date, generated.startMinutes).toDate(),
                endTime: minutesOfDay(date, generated.endMinutes).toDate(),
                isRecurrenceEcho: false,
                generatedBreak: {
                    kind: generated.kind,
                    title: generated.title,
                    coversPrayer: generated.coversPrayer,
                },
            });
            reportedBreaks.push({ ...generated, dayId, occurrenceDate: date });
        }
    }

    // ---------------------------------------------------------------------
    // Decisions: everything the cut could not settle on its own.
    // ---------------------------------------------------------------------

    const weekNumberById = new Map(
        input.weeks.map((week, index) => [ week.id, index + 1 ]),
    );
    const decisions: Array<CutDecision> = [
        ...balanced.overflows.map((overflow) => ({
            type: "week-overflow" as const,
            weekId: overflow.weekId,
            weekNumber: weekNumberById.get(overflow.weekId) ?? 0,
            excessMinutes: overflow.excessMinutes,
            overloadedDays: overflow.overloadedDays,
        })),
        ...(constraintOutcome.proposals.length > 0
            ? [
                {
                    type: "constraint-moves" as const,
                    proposals: constraintOutcome.proposals.filter(
                        (proposal) => !acceptedMoves.has(proposal.eventId),
                    ),
                },
            ].filter((decision) => decision.proposals.length > 0)
            : []),
        ...constraintOutcome.violations.map((violation) => ({
            type: "constraint-violation" as const,
            violation,
        })),
    ];

    return {
        ok: true,
        occurrences,
        report: {
            moves: balanced.moves,
            spills: summarizeSpills(balanced.moves, {
                titleOf: (eventId) =>
                    eventsById.get(eventId)?.title ?? eventId,
                dateOf: dayDate,
            }),
            overflows: balanced.overflows,
            breaks: reportedBreaks,
            constraintProposals: constraintOutcome.proposals,
            constraintViolations: constraintOutcome.violations,
            decisions,
        },
    };
}

/**
 * Turn the balancer's raw moves into display-ready spill details.
 *
 * The balancer cascades: one slot can be pushed off ראשון and then off שני,
 * producing two moves for the same `slotKey`. The user cares about the net
 * effect, so consecutive moves of a slot collapse into one entry running from
 * its first source day to its final target.
 */
function summarizeSpills(
    moves: Array<SpillMove>,
    resolve: {
        titleOf: (eventId: string) => string;
        dateOf: (dayId: string) => string;
    },
): Array<CutSpillDetail> {
    const bySlot = new Map<string, CutSpillDetail>();

    for (const move of moves) {
        const existing = bySlot.get(move.slotKey);
        if (existing) {
            existing.toDayId = move.toDayId;
            existing.toDate = resolve.dateOf(move.toDayId);
            continue;
        }
        bySlot.set(move.slotKey, {
            slotKey: move.slotKey,
            eventId: move.eventId,
            title: resolve.titleOf(move.eventId),
            fromDayId: move.fromDayId,
            toDayId: move.toDayId,
            fromDate: resolve.dateOf(move.fromDayId),
            toDate: resolve.dateOf(move.toDayId),
            durationMinutes: move.durationMinutes,
        });
    }

    // A slot bounced back onto its original day did not really move.
    return Array.from(bySlot.values()).filter(
        (spill) => spill.fromDayId !== spill.toDayId,
    );
}
