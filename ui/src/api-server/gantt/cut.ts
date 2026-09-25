import { randomUUID } from "crypto";

import { Filter } from "mongodb";

import { isDuplicateKeyError } from "@/api-server/common";
import { DbCourses } from "@/api-server/db-courses";
import {
    DbEventHistory,
    EventWriteOrigin,
} from "@/api-server/db-event-history";
import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { syncEventToInstructorsGoogleCalendars } from "@/api-server/google/google-calendar-sync";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    DatabaseController,
    getDatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import {
    lowestCommonCourse,
    SHUFFLE_COURSE_DESCRIPTION_PREFIX,
} from "@/api-shared/course-tree";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import {
    CutPlanEventInput,
    CutPlanInput,
    CutPlanOptions,
    CutPlanReport,
    CutValidationError,
    isGeneratedBreakEventId,
    PlannedOccurrence,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from "@/api-shared/types";
import { Course } from "@/api-shared/types/course";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import {
    ApiCurriculumCutError,
    ApiCurriculumCutPlanResponse,
    ApiCurriculumCutPreviewResponse,
    ApiCurriculumCutResponse,
    ApiCurriculumCutStatus,
    ApiCurriculumPullBackError,
    ApiCurriculumPullBackResponse,
    ApiCutPreviewOccurrence,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId, ModuleEventType } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import {
    MealSettings,
    MEAL_EVENT_TITLES,
    MEAL_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/meal";
import { PRAYER_TIMES_SETTING_KEY, PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
    SCHEDULE_SETTINGS_KEY,
    ScheduleSettings,
} from "@/api-shared/types/settings/schedule";
import { logger } from "@/logging/pino";
import { iterationSyncId, MessageTypes } from "@/settings";

/**
 * Server orchestration for the curriculum → schedule cut ("גזירה ללו"ז", #118).
 * Consumes the pure planner (#117) and writes the resulting occurrences into the
 * linked iteration's MongoDB. This is `api-server`: it reads gantt data from
 * Postgres (Drizzle) and writes schedule events to Mongo. The pure adaptation /
 * mapping helpers are exported so they can be unit-tested without any DB.
 */

export type CutOutcome =
    | { ok: false; error: ApiCurriculumCutError }
    | { ok: true; result: ApiCurriculumCutResponse };

export type PullBackOutcome =
    | { ok: false; error: ApiCurriculumPullBackError }
    | { ok: true; result: ApiCurriculumPullBackResponse };

/** Plain-data mapping row (subset of the Drizzle `cMDA` row). */
export type CutMappingRow = {
    eventId: null | string;
    dayId: string;
    sortOrder?: null | number;
};

/** Plain-data recurrence-exception row. */
export type CutExceptionRow = { eventId: string; dayId: string };

/** Plain-data constraint row (subset of the Drizzle `cntrs` row). */
export type CutConstraintRow = {
    id: string;
    type: "RELATIONAL" | "TEMPORAL";
    ownerEventId: null | string;
    ownerModuleId: null | string;
    relation: "after" | "before" | null;
    targetEventId: null | string;
    targetModuleId: null | string;
    minDelayDays: null | number;
    maxDelayDays: null | number;
    allowedDays: Array<number> | null;
    forbiddenDays: Array<number> | null;
};

/**
 * Adapt stored constraint rows into the domain `GanttConstraint` union the
 * solver consumes. The table is a single flat shape covering both variants, so
 * a row that does not carry the columns its own type requires (a relational
 * row with no target, an ownerless row) is dropped rather than fed to the
 * solver as a half-built constraint.
 */
export function toGanttConstraints(
    rows: Array<CutConstraintRow>,
): Array<GanttConstraint> {
    const constraints: Array<GanttConstraint> = [];

    for (const row of rows) {
        const owner = row.ownerEventId
            ? ({ ownerType: "event", ownerEventId: row.ownerEventId } as const)
            : row.ownerModuleId
                ? ({ ownerType: "module", ownerModuleId: row.ownerModuleId } as const)
                : null;
        if (!owner) continue;

        if (row.type === "TEMPORAL") {
            constraints.push({
                ...owner,
                id: row.id,
                type: ConstraintType.Temporal,
                allowedDays: (row.allowedDays ?? undefined) as
                    Array<GanttDayIndex> | undefined,
                forbiddenDays: (row.forbiddenDays ?? undefined) as
                    Array<GanttDayIndex> | undefined,
            } as GanttConstraint);
            continue;
        }

        const targetId = row.targetEventId ?? row.targetModuleId;
        if (!targetId || !row.relation) continue;

        constraints.push({
            ...owner,
            id: row.id,
            type: ConstraintType.Relational,
            targetId,
            targetType: row.targetEventId ? "event" : "module",
            relation: row.relation,
            ...(row.minDelayDays !== null ? { minDelayDays: row.minDelayDays } : {}),
            ...(row.maxDelayDays !== null ? { maxDelayDays: row.maxDelayDays } : {}),
        } as GanttConstraint);
    }

    return constraints;
}

/**
 * Maps a Gantt module event type to its calendar counterpart. The enum values
 * are aligned one-to-one (הרצאה/ע"ע/ל"ע/אחר), but the mapping is explicit so a
 * future divergence is a compile error rather than a silent mismatch.
 */
export function moduleEventTypeToCalendarType(
    type: ModuleEventType,
): EventType {
    const LOOKUP: Record<ModuleEventType, EventType> = {
        [ModuleEventType.Lecture]: EventType.LECTURE,
        [ModuleEventType.Exercise]: EventType.EXERCISE,
        [ModuleEventType.SelfTeaching]: EventType.SELF_TEACHING,
        [ModuleEventType.Other]: EventType.OTHER,
    };
    return LOOKUP[type] ?? EventType.OTHER;
}

const MEAL_TITLES = new Set<string>(Object.values(MEAL_EVENT_TITLES));

/**
 * Calendar type of a cut occurrence. The auto-seeded meal events become real
 * break (הפסקה) events rather than generic "אחר" ones: the planner already
 * treats their windows as breaks while stacking, and once in the schedule they
 * must keep interrupting the events that split across breaks.
 */
export function scheduleEventTypeFor(ganttEvent: {
    title: string;
    type: ModuleEventType;
}): EventType {
    return MEAL_TITLES.has(ganttEvent.title)
        ? EventType.BREAK
        : moduleEventTypeToCalendarType(ganttEvent.type);
}

/**
 * Walk the full curriculum tree once, indexing every event by id and recording
 * the title of the syllabus each event lives under (used as course provenance).
 */
export function indexCurriculumEvents(curriculum: ApiCurriculum): {
    eventsById: Map<string, ApiModuleEvent>;
    syllabusTitleByEvent: Map<string, string>;
    moduleHiveIdsByEvent: Map<string, Array<number>>;
    /** Owning gantt module id per event — spillover keeps a module together. */
    moduleIdByEvent: Map<string, string>;
    /** Owning syllabus id per event — drives the between-syllabuses break rule. */
    syllabusIdByEvent: Map<string, string>;
    /** Module id → its event ids, for fanning out module-level constraints. */
    eventIdsByModule: Map<string, Array<string>>;
    /** Module titles, used in constraint-violation messages. */
    moduleTitleById: Map<string, string>;
    /** Courses (מסלולים) the owning syllabus is assigned to, per event. */
    syllabusCourseIdsByEvent: Map<string, Array<string>>;
    /**
     * Shuffles each event runs for: its own, else its module's, else its
     * syllabus's. Empty when none is set anywhere up the chain.
     */
    shufflesByEvent: Map<string, Array<string>>;
} {
    const eventsById = new Map<string, ApiModuleEvent>();
    const syllabusTitleByEvent = new Map<string, string>();
    const moduleHiveIdsByEvent = new Map<string, Array<number>>();
    const moduleIdByEvent = new Map<string, string>();
    const syllabusIdByEvent = new Map<string, string>();
    const eventIdsByModule = new Map<string, Array<string>>();
    const moduleTitleById = new Map<string, string>();
    const syllabusCourseIdsByEvent = new Map<string, Array<string>>();
    const shufflesByEvent = new Map<string, Array<string>>();
    const firstNonEmpty = (...lists: Array<Array<string> | null | undefined>) =>
        lists.find((list) => list && list.length > 0) ?? [];

    for (const cLink of curriculum.c2s ?? []) {
        const syllabus = cLink.syllabus;
        for (const sLink of syllabus.s2m ?? []) {
            const ganttModule = sLink.module;
            moduleTitleById.set(ganttModule.id, ganttModule.title);
            for (const mLink of ganttModule.m2e ?? []) {
                const event = mLink.event;
                eventsById.set(event.id, event);
                syllabusTitleByEvent.set(event.id, syllabus.title);
                moduleHiveIdsByEvent.set(event.id, ganttModule.hiveIds ?? []);
                moduleIdByEvent.set(event.id, ganttModule.id);
                syllabusIdByEvent.set(event.id, syllabus.id);
                syllabusCourseIdsByEvent.set(event.id, syllabus.courseIds ?? []);
                shufflesByEvent.set(
                    event.id,
                    firstNonEmpty(
                        event.shuffles,
                        ganttModule.shuffles,
                        syllabus.shuffles,
                    ),
                );
                eventIdsByModule.set(ganttModule.id, [
                    ...(eventIdsByModule.get(ganttModule.id) ?? []),
                    event.id,
                ]);
            }
        }
    }

    return {
        eventsById,
        syllabusTitleByEvent,
        moduleHiveIdsByEvent,
        moduleIdByEvent,
        syllabusIdByEvent,
        eventIdsByModule,
        moduleTitleById,
        syllabusCourseIdsByEvent,
        shufflesByEvent,
    };
}

/**
 * Prayer windows for the planner, read out of the MongoDB schedule settings.
 *
 * The Gantt/Postgres side has no prayer data of its own, so the server is the
 * only layer that can bridge the two engines — the pure planner just receives
 * `"HH:mm"` strings. A malformed or missing setting simply contributes no
 * window: prayers are a soft preference and must never fail a cut.
 */
export function prayerWindowsFromSettings(
    settings: null | PrayerSettings,
): Array<{ name: string; time: string }> {
    if (!settings) return [];

    const LABELS: Record<keyof PrayerSettings, string> = {
        shacharit: "שחרית",
        mincha: "מנחה",
        arvit: "ערבית",
    };

    const windows: Array<{ name: string; time: string }> = [];
    for (const key of Object.keys(LABELS) as Array<keyof PrayerSettings>) {
        const raw = settings[key] as Date | number | string | undefined;
        if (raw === undefined || raw === null) continue;
        const parsed = dayjs(raw as never).tz(APP_TIMEZONE);
        if (!parsed.isValid()) continue;
        windows.push({ name: LABELS[key], time: parsed.format("HH:mm") });
    }
    return windows;
}

/**
 * Adapt the loaded Postgres rows into the pure planner's plain-data input.
 * Weeks are ordered by `number` and days within a week by `dayIndex`, matching
 * the timeline ordering used by the client normalizer.
 */
export function buildCutPlanInput(args: {
    curriculum: ApiCurriculum;
    mappings: Array<CutMappingRow>;
    exceptions: Array<CutExceptionRow>;
    dayStartTime: string;
    weekendHomeStartTime?: string;
    breakfastTime?: string;
    lunchTime?: string;
    dinnerTime?: string;
    /** Prayer windows bridged over from the MongoDB schedule settings. */
    prayerTimes?: Array<{ name: string; time: string }>;
    /** Constraint rows for this curriculum (owned by its events and modules). */
    constraints?: Array<GanttConstraint>;
}): CutPlanInput {
    const {
        curriculum,
        mappings,
        exceptions,
        dayStartTime,
        weekendHomeStartTime,
        breakfastTime,
        lunchTime,
        dinnerTime,
        prayerTimes,
        constraints = [],
    } = args;

    const days: CutPlanInput["days"] = {};
    const weekLinks = [...(curriculum.c2w ?? [])].sort(
        (a, b) => a.week.number - b.week.number,
    );
    const weeks = weekLinks.map((wLink) => {
        const dayLinks = [...(wLink.week.w2d ?? [])].sort(
            (a, b) => a.day.dayIndex - b.day.dayIndex,
        );
        const dayIds = dayLinks.map((dLink) => {
            days[dLink.day.id] = {
                id: dLink.day.id,
                dayIndex: dLink.day.dayIndex,
                totalWorkingMinutes: dLink.day.totalWorkingMinutes,
                dayEndTime: dLink.day.dayEndTime ?? null,
            };
            return dLink.day.id;
        });
        return {
            id: wLink.week.id,
            dayIds,
            weekendDuty: wLink.week.weekendDuty ?? true,
        };
    });

    const {
        eventsById,
        moduleIdByEvent,
        syllabusIdByEvent,
        eventIdsByModule,
        moduleTitleById,
    } = indexCurriculumEvents(curriculum);

    // Constraints arrive as a flat list; index them by owner so each event
    // carries its own and each module contributes one fan-out entry.
    const constraintsByEvent = new Map<string, Array<GanttConstraint>>();
    const constraintsByModule = new Map<string, Array<GanttConstraint>>();
    for (const constraint of constraints) {
        if (constraint.ownerType === "event") {
            constraintsByEvent.set(constraint.ownerEventId, [
                ...(constraintsByEvent.get(constraint.ownerEventId) ?? []),
                constraint,
            ]);
        } else {
            constraintsByModule.set(constraint.ownerModuleId, [
                ...(constraintsByModule.get(constraint.ownerModuleId) ?? []),
                constraint,
            ]);
        }
    }

    const events = Array.from(eventsById.values()).map((event) => ({
        id: event.id,
        title: event.title,
        recurrence: event.recurrence,
        minimumDuration: event.minimumDuration,
        allocatedDuration: event.cEC?.[0]?.allocatedDuration ?? 0,
        splitAcrossBreaks: event.splitAcrossBreaks,
        type: event.type,
        moduleId: moduleIdByEvent.get(event.id) ?? null,
        syllabusId: syllabusIdByEvent.get(event.id) ?? null,
        // The cut assigns no rooms yet, so the room-change break rule stays
        // inert (it is disabled in `cut-rules.ts` to match).
        roomName: null,
        constraints: constraintsByEvent.get(event.id) ?? [],
        groupId: event.groupId ?? null,
    }));

    return {
        startDate: curriculum.startDate ?? null,
        weeks,
        days,
        events,
        mappings: mappings
            .filter((m): m is CutMappingRow & { eventId: string } =>
                Boolean(m.eventId),
            )
            .map((m) => ({
                eventId: m.eventId,
                dayId: m.dayId,
                sortOrder: m.sortOrder ?? 0,
            })),
        recurrenceExceptions: exceptions.map((e) => ({
            eventId: e.eventId,
            dayId: e.dayId,
        })),
        dayStartTime,
        weekendHomeStartTime,
        breakfastTime,
        lunchTime,
        dinnerTime,
        prayerTimes,
        moduleConstraints: [...constraintsByModule.entries()].map(
            ([moduleId, moduleConstraints]) => ({
                moduleId,
                title: moduleTitleById.get(moduleId) ?? moduleId,
                constraints: moduleConstraints,
            }),
        ),
        eventIdsByModule: Object.fromEntries(eventIdsByModule),
    };
}

/**
 * Number of overlapping pairs of occurrences: two occurrences on the same date
 * whose time ranges intersect. Purely informational for the cut summary.
 * Shuffle-group siblings (#699) run side by side by design, so a pair sharing a
 * `groupId` is not an overlap that needs manual fixing.
 */
export function countOverlappingOccurrences(
    occurrences: Array<PlannedOccurrence>,
    events: Array<CutPlanEventInput>,
): number {
    const groupByEvent = new Map(
        events.map((event) => [event.id, event.groupId ?? null]),
    );
    const byDate = new Map<string, Array<PlannedOccurrence>>();
    for (const occ of occurrences) {
        const arr = byDate.get(occ.occurrenceDate) ?? [];
        arr.push(occ);
        byDate.set(occ.occurrenceDate, arr);
    }

    let overlaps = 0;
    for (const group of byDate.values()) {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const a = group[i];
                const b = group[j];
                const groupA = groupByEvent.get(a.ganttEventId);
                if (groupA && groupA === groupByEvent.get(b.ganttEventId)) {
                    continue;
                }
                if (
                    a.startTime.getTime() < b.endTime.getTime() &&
                    b.startTime.getTime() < a.endTime.getTime()
                ) {
                    overlaps++;
                }
            }
        }
    }
    return overlaps;
}

/**
 * Build a single schedule-event document from a planned occurrence and its
 * source gantt event. Hive linkage is copied when present on the event
 * itself; when the event has no linkage of its own, it falls back to the
 * first Hive module linked on its containing Gantt module (via
 * `hiveModuleSubjectById`), since users commonly link Hive at the module
 * level (module dialog chips) rather than per-event. Only when neither is
 * set is the event stored as a non-Hive placeholder (subject/module 0,
 * lesson null), matching how "fake" events represent "no Hive linkage".
 */
export function buildScheduleEvent(
    occurrence: PlannedOccurrence,
    ganttEvent: ApiModuleEvent,
    courseIds: Array<string>,
    moduleHiveIds: Array<number>,
    hiveModuleSubjectById: Map<number, number>,
    curriculumId: GanttCurriculumId,
): DbEventDocument {
    const fallbackHiveModuleId = ganttEvent.hiveModuleId ?? moduleHiveIds[0] ?? null;
    const fallbackHiveSubjectId =
        ganttEvent.hiveSubjectId ??
        (fallbackHiveModuleId != null
            ? hiveModuleSubjectById.get(fallbackHiveModuleId) ?? null
            : null);
    // Breakfast/lunch/dinner default to locked (מתואם).
    const isMealEvent = MEAL_TITLES.has(ganttEvent.title);

    return {
        id: randomUUID(),
        name: ganttEvent.title,
        type: scheduleEventTypeFor(ganttEvent),
        subject: fallbackHiveSubjectId ?? 0,
        hiveModule: fallbackHiveModuleId ?? 0,
        hiveLesson: ganttEvent.hiveLessonId ?? null,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        courses: courseIds,
        rooms: [],
        instructors:
            ganttEvent.orchestratorId != null
                ? [ganttEvent.orchestratorId]
                : [],
        lecturers: [],
        tags: [],
        notes: ganttEvent.comment ?? "",
        locked: isMealEvent,
        hidden: false,
        required: false,
        personalTalk: false,
        splitAcrossBreaks: ganttEvent.splitAcrossBreaks,
        fake: false,
        ganttEventId: ganttEvent.id,
        ganttOccurrenceDate: occurrence.occurrenceDate,
        ganttCurriculumId: curriculumId,
    };
}

/**
 * Build a schedule event for a break the post-pass invented. It has no gantt
 * event behind it, so everything comes from the occurrence itself. The
 * synthetic `ganttEventId` marks it as cut-generated, which is exactly what
 * `pullBackCutSchedule` matches on — breaks are archived with the rest of the
 * cut and never survive to be duplicated by a re-cut.
 */
export function buildGeneratedBreakEvent(
    occurrence: PlannedOccurrence,
    courseIds: Array<string>,
    curriculumId: GanttCurriculumId,
): DbEventDocument {
    return {
        id: randomUUID(),
        name: occurrence.generatedBreak?.title ?? "הפסקה",
        type: EventType.BREAK,
        subject: 0,
        hiveModule: 0,
        hiveLesson: null,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        courses: courseIds,
        rooms: [],
        instructors: [],
        lecturers: [],
        tags: [],
        notes: occurrence.generatedBreak?.coversPrayer
            ? `הפסקה שנוצרה אוטומטית (${occurrence.generatedBreak.kind}), מכסה ${occurrence.generatedBreak.coversPrayer}`
            : `הפסקה שנוצרה אוטומטית (${occurrence.generatedBreak?.kind ?? ""})`,
        locked: false,
        hidden: false,
        required: false,
        personalTalk: false,
        splitAcrossBreaks: false,
        fake: false,
        ganttEventId: occurrence.ganttEventId,
        ganttOccurrenceDate: occurrence.occurrenceDate,
        ganttCurriculumId: curriculumId,
    };
}

/** Attempts (and backoff between them) for the Hive module fetch below. */
const HIVE_MODULES_ATTEMPTS = 3;
const HIVE_MODULES_RETRY_DELAYS_MS = [250, 1000];

/** The Hive module → subject map, plus whether Hive refused to supply it. */
type HiveModuleSubjectLookup = {
    byModuleId: Map<number, number>;
    /** True when every attempt failed, so the map is empty by accident. */
    unavailable: boolean;
};

/**
 * Maps every Hive module id to its parent subject id, used to resolve the
 * subject for events that only carry a module-level Hive link (#hiveIds set
 * on the Gantt module, not on the event itself).
 *
 * Still best-effort — a Hive outage must not block the cut — but no longer
 * silently so (#662). `createHiveClient` does session/token setup on the first
 * call against a given `hiveUrl`, which is exactly when a cold/slow Hive is
 * most likely to fail; one blip used to stamp every module-linked event
 * `subject: 0` permanently, visible only as missing colours. So: retry with
 * backoff, and report the failure to the caller so it can be surfaced instead
 * of buried in a log line.
 */
async function buildHiveModuleSubjectMap(
    hiveUrl?: string,
): Promise<HiveModuleSubjectLookup> {
    for (let attempt = 0; attempt < HIVE_MODULES_ATTEMPTS; attempt++) {
        try {
            const hive = await createHiveClient(hiveUrl);
            const modules = await hive.getModules();
            return {
                byModuleId: new Map(
                    modules.map((m) => [Number(m.id), m.parent_subject]),
                ),
                unavailable: false,
            };
        } catch (e) {
            // A retried attempt is not yet a failure — only the last one is.
            const delay = HIVE_MODULES_RETRY_DELAYS_MS[attempt];
            const log = delay === undefined ? logger.error : logger.warn;
            log.call(
                logger,
                { attempt: attempt + 1, err: e, willRetry: delay !== undefined },
                "Failed to load Hive modules for cut subject fallback",
            );
            if (delay === undefined) break;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    return { byModuleId: new Map(), unavailable: true };
}

/**
 * Dry-run of the cut ("תצוגה מקדימה", preview tabs): runs the exact same
 * pipeline as `cutCurriculumToSchedule` up to and including `planCut`, but
 * skips every gate (draft, iteration link, already-cut) and writes nothing.
 * Schedule timing settings come from the linked iteration when one exists,
 * falling back to the defaults otherwise so drafts still preview.
 */
export async function previewCurriculumCut(
    curriculumId: GanttCurriculumId,
    options: CutPlanOptions = {},
): Promise<ApiCurriculumCutPreviewResponse> {
    const curriculum = await DbCurriculum.getItem(curriculumId);

    const [mappings, exceptions, iteration, constraints] = await Promise.all([
        getModuleDayMappingsForCurriculum(curriculumId, {}),
        listRecurrenceExceptionsForCurriculum(curriculumId),
        DbIterations.getByCurriculum(curriculumId),
        getConstraintsForCurriculum(curriculumId),
    ]);

    // Read the schedule settings (day start times) regardless of whether the
    // curriculum is linked to an iteration yet: use the iteration's own db when
    // it exists, otherwise the main/default db so draft curricula still honour
    // the global dayStartTime instead of falling back to 08:00 (#324).
    const settingsController = iteration
        ? getDatabaseController(iteration.dbName)
        : getDatabaseController();
    const [ scheduleSetting, mealSetting, prayerSetting ] = await Promise.all([
        DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, settingsController) as
            Promise<null | ScheduleSettings>,
        DbSettings.get(MEAL_TIMES_SETTING_KEY, undefined, settingsController) as
            Promise<MealSettings | null>,
        DbSettings.get(PRAYER_TIMES_SETTING_KEY, undefined, settingsController) as
            Promise<null | PrayerSettings>,
    ]);
    const dayStartTime =
        scheduleSetting?.dayStartTime ?? DEFAULT_DAY_START_TIME;
    const weekendHomeStartTime =
        scheduleSetting?.weekendHomeStartTime ??
        DEFAULT_WEEKEND_HOME_START_TIME;

    const planInput = buildCutPlanInput({
        curriculum,
        mappings: mappings as Array<CutMappingRow>,
        exceptions: exceptions as Array<CutExceptionRow>,
        dayStartTime,
        weekendHomeStartTime,
        breakfastTime: mealSetting?.breakfastTime,
        lunchTime: mealSetting?.lunchTime,
        dinnerTime: mealSetting?.dinnerTime,
        prayerTimes: prayerWindowsFromSettings(prayerSetting),
        constraints: toGanttConstraints(constraints as Array<CutConstraintRow>),
    });

    // Preview is tolerant where the real cut is strict: per-event problems
    // (unmapped / unsatisfied recurrence) skip just that event and re-plan
    // instead of failing the whole preview. Only a missing start date — which
    // makes every occurrence undatable — is fatal.
    let plan = planCut(planInput, options);
    const skipped: Array<CutValidationError> = [];
    if (!plan.ok) {
        const fatal = plan.errors.filter(
            (error) => error.type === "missing-start-date",
        );
        if (fatal.length > 0) {
            return { ok: false, errors: plan.errors };
        }
        const skippedEventIds = new Set<string>();
        for (const error of plan.errors) {
            if ("eventId" in error) {
                skipped.push(error);
                skippedEventIds.add(error.eventId);
            }
        }
        plan = planCut(
            {
                ...planInput,
                events: planInput.events.filter(
                    (event) => !skippedEventIds.has(event.id),
                ),
            },
            options,
        );
        if (!plan.ok) {
            return { ok: false, errors: plan.errors };
        }
    }

    // Index titles for display metadata (event → syllabus / module).
    const { eventsById, syllabusTitleByEvent } =
        indexCurriculumEvents(curriculum);
    const moduleTitleByEvent = new Map<string, string>();
    for (const cLink of curriculum.c2s ?? []) {
        for (const sLink of cLink.syllabus.s2m ?? []) {
            for (const mLink of sLink.module.m2e ?? []) {
                moduleTitleByEvent.set(mLink.event.id, sLink.module.title);
            }
        }
    }

    const occurrences: Array<ApiCutPreviewOccurrence> = plan.occurrences.map(
        (occ) => {
            const ganttEvent = eventsById.get(occ.ganttEventId);
            const isGenerated = isGeneratedBreakEventId(occ.ganttEventId);
            return {
                ganttEventId: occ.ganttEventId,
                title:
                    occ.generatedBreak?.title ??
                    ganttEvent?.title ??
                    occ.ganttEventId,
                eventType: ganttEvent?.type ?? ModuleEventType.Other,
                hiveSubjectId: ganttEvent?.hiveSubjectId ?? null,
                syllabusTitle: syllabusTitleByEvent.get(occ.ganttEventId) ?? "",
                moduleTitle: moduleTitleByEvent.get(occ.ganttEventId) ?? "",
                occurrenceDate: occ.occurrenceDate,
                startTime: occ.startTime.toISOString(),
                endTime: occ.endTime.toISOString(),
                isRecurrenceEcho: occ.isRecurrenceEcho,
                isGeneratedBreak: isGenerated,
                breakKind: occ.generatedBreak?.kind ?? null,
                spilled: Boolean(occ.spilledFromDayId),
            };
        },
    );

    return {
        ok: true,
        occurrences,
        overlaps: countOverlappingOccurrences(plan.occurrences, planInput.events),
        skipped,
        report: plan.report,
    };
}

/**
 * Matches the live (non-archived) schedule events produced by cutting
 * `curriculumId`. Cut events always store a string `ganttEventId`, so that
 * `$exists` is what separates them from hand-made events.
 *
 * Scoping to the curriculum matters when an iteration is relinked from one
 * curriculum to another — a duplicate of the original, say. "This iteration
 * holds cut events" was the old test, which reported a never-cut curriculum as
 * already cut and refused to cut it, purely because the curriculum that used
 * to be linked had left its events behind (#661).
 *
 * Events cut before `ganttCurriculumId` was stamped on them carry no curriculum
 * at all. They still belong to whichever curriculum the iteration is linked to,
 * so they are matched too — dropping them would make an old cut invisible to
 * the gate and let it be cut a second time on top of itself.
 */
export function cutEventFilter(
    curriculumId: GanttCurriculumId,
): Filter<DbEventDocument> {
    return {
        ganttEventId: { $exists: true },
        archived: { $ne: true },
        // "Not a string" is missing *and* explicitly null in one clause — both
        // shapes exist in databases written before the field was introduced.
        $or: [
            { ganttCurriculumId: curriculumId },
            { ganttCurriculumId: { $not: { $type: "string" } } },
        ],
    };
}

/** Count of already-cut, live events belonging to this curriculum. */
async function countCutEvents(
    controller: DatabaseController,
    curriculumId: GanttCurriculumId,
): Promise<number> {
    return await controller.events.countDocuments(cutEventFilter(curriculumId));
}

/**
 * Live cut events in this iteration that belong to a *different* curriculum.
 *
 * Scoping the gate to the target curriculum (#661) is what stops a legitimate
 * duplicate being refused — but on its own it would let the duplicate be cut
 * on top of the other curriculum's still-live schedule. The calendar is scoped
 * to the iteration and does not filter by curriculum, so the result is one
 * schedule showing both cuts overlaid, and neither curriculum's pull-back can
 * clear the other's half. Detected here so the cut can refuse with a reason
 * the user can act on instead of quietly producing that.
 *
 * @returns How many such events exist and one owning curriculum id, or null
 * when the iteration holds no foreign cut.
 */
async function findForeignCut(
    controller: DatabaseController,
    curriculumId: GanttCurriculumId,
): Promise<{ count: number; curriculumId: string } | null> {
    const filter: Filter<DbEventDocument> = {
        ganttEventId: { $exists: true },
        archived: { $ne: true },
        // A string that is not ours. Legacy events carry no curriculum at all
        // and are deliberately excluded — `cutEventFilter` already treats those
        // as the linked curriculum's own.
        ganttCurriculumId: { $type: "string", $ne: curriculumId },
    };
    const count = await controller.events.countDocuments(filter);
    if (count === 0) return null;

    const sample = await controller.events.findOne(filter, {
        projection: { ganttCurriculumId: 1, _id: 0 },
    });
    return {
        count,
        curriculumId: sample?.ganttCurriculumId ?? "",
    };
}

/** The documents a plan materializes into, plus what producing them created. */
export type MaterializationOutcome =
    | { ok: false; errors: Array<CutValidationError> }
    | {
          ok: true;
          documents: Array<DbEventDocument>;
          createdCourses: Array<{ id: string; name: string }>;
          /**
           * True when Hive could not supply the module → subject map and at
           * least one event was left subject-less because of it (#662). The
           * events are still written; the caller is expected to tell the user
           * a reload will fix their colours.
           */
          hiveSubjectsUnavailable: boolean;
          overlaps: number;
          /** What the balancer, break pass and constraint solver did. */
          report: CutPlanReport;
      };

/**
 * Plan a curriculum and turn the planned occurrences into schedule-event
 * documents. Shared by the one-shot cut and the reload (#…): both need exactly
 * the same "what should the schedule look like" computation, and only differ in
 * what they do with the result.
 *
 * @param curriculum The loaded curriculum tree.
 * @param iteration The linked iteration (its db supplies settings and courses).
 * @param controller Controller for the iteration database.
 * @param options.force Plan around unmapped / unsatisfied-recurrence events.
 * @param options.createMissingCourses When false (dry runs) shuffles with no
 * existing course are simply left out instead of creating a course.
 * @returns The intended documents, or the planner's validation errors.
 */
export async function materializeCurriculumEvents(
    curriculum: ApiCurriculum,
    iteration: { dbName: string; hiveUrl?: string },
    controller: DatabaseController,
    options: CutPlanOptions & { createMissingCourses?: boolean } = {},
): Promise<MaterializationOutcome> {
    const { createMissingCourses = true, ...planOptions } = options;
    const curriculumId = curriculum.id as GanttCurriculumId;

    const [
        mappings,
        exceptions,
        constraints,
        scheduleSetting,
        mealSetting,
        prayerSetting,
    ] = await Promise.all([
        getModuleDayMappingsForCurriculum(curriculumId, {}),
        listRecurrenceExceptionsForCurriculum(curriculumId),
        getConstraintsForCurriculum(curriculumId),
        DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, controller),
        DbSettings.get(MEAL_TIMES_SETTING_KEY, undefined, controller),
        DbSettings.get(PRAYER_TIMES_SETTING_KEY, undefined, controller),
    ]);
    const dayStartTime =
        (scheduleSetting as null | ScheduleSettings)?.dayStartTime ??
        DEFAULT_DAY_START_TIME;
    const weekendHomeStartTime =
        (scheduleSetting as null | ScheduleSettings)?.weekendHomeStartTime ??
        DEFAULT_WEEKEND_HOME_START_TIME;
    const breakfastTime = (mealSetting as MealSettings | null)?.breakfastTime;
    const lunchTime = (mealSetting as MealSettings | null)?.lunchTime;
    const dinnerTime = (mealSetting as MealSettings | null)?.dinnerTime;

    const {
        eventsById,
        syllabusTitleByEvent,
        moduleHiveIdsByEvent,
        syllabusCourseIdsByEvent,
        shufflesByEvent,
    } = indexCurriculumEvents(curriculum);
    const hiveModules = await buildHiveModuleSubjectMap(iteration.hiveUrl);
    const hiveModuleSubjectById = hiveModules.byModuleId;

    const planInput = buildCutPlanInput({
        curriculum,
        mappings: mappings as Array<CutMappingRow>,
        exceptions: exceptions as Array<CutExceptionRow>,
        dayStartTime,
        weekendHomeStartTime,
        breakfastTime,
        lunchTime,
        dinnerTime,
        prayerTimes: prayerWindowsFromSettings(
            prayerSetting as null | PrayerSettings,
        ),
        constraints: toGanttConstraints(constraints as Array<CutConstraintRow>),
    });
    const plan = planCut(planInput, planOptions);
    if (!plan.ok) {
        return { ok: false, errors: plan.errors };
    }

    // Resolve / create courses for the shuffles referenced by cut events.
    const cutEventIds = new Set(
        plan.occurrences.map((occ) => occ.ganttEventId),
    );
    const shuffleNames = new Set<string>();
    const syllabusTitleForShuffle = new Map<string, string>();
    const syllabusCourseIdsForShuffle = new Map<string, Set<string>>();
    for (const eventId of cutEventIds) {
        for (const name of shufflesByEvent.get(eventId) ?? []) {
            shuffleNames.add(name);
            const courseIds = syllabusCourseIdsForShuffle.get(name) ?? new Set();
            for (const id of syllabusCourseIdsByEvent.get(eventId) ?? []) {
                courseIds.add(id);
            }
            syllabusCourseIdsForShuffle.set(name, courseIds);
            if (!syllabusTitleForShuffle.has(name)) {
                syllabusTitleForShuffle.set(
                    name,
                    syllabusTitleByEvent.get(eventId) ?? "",
                );
            }
        }
    }

    const existingCourses = await DbCourses.get(undefined, controller);
    const courseIdByName = new Map(
        existingCourses.map((c) => [c.name, c.id]),
    );
    const createdCourses: Array<{ id: string; name: string }> = [];
    const shuffleCourseId = new Map<string, string>();

    for (const name of shuffleNames) {
        let id = courseIdByName.get(name);
        if (!id) {
            // Dry runs must not write: an unknown shuffle simply contributes no
            // course id, which is what the diff would show anyway.
            if (!createMissingCourses) continue;
            const course: Course = {
                id: randomUUID(),
                name,
                color: null,
                parentId: lowestCommonCourse(
                    syllabusCourseIdsForShuffle.get(name) ?? [],
                    existingCourses,
                ),
                description: `${SHUFFLE_COURSE_DESCRIPTION_PREFIX} "${syllabusTitleForShuffle.get(name) ?? ""}"`,
            };
            await DbCourses.create(course, controller);
            id = course.id;
            courseIdByName.set(name, id);
            createdCourses.push({ id, name });
        }
        shuffleCourseId.set(name, id);
    }

    const allCourseIds = [
        ...existingCourses.map((c) => c.id),
        ...createdCourses.map((c) => c.id),
    ];

    // Build one schedule event per planned occurrence.
    const documents: Array<DbEventDocument> = [];
    for (const occurrence of plan.occurrences) {
        // Breaks the post-pass invented have no gantt event behind them.
        if (isGeneratedBreakEventId(occurrence.ganttEventId)) {
            documents.push(
                buildGeneratedBreakEvent(occurrence, allCourseIds, curriculumId),
            );
            continue;
        }

        const event = eventsById.get(occurrence.ganttEventId);
        if (!event) continue;

        // Shuffle courses first, else the syllabus's own courses, else none.
        const shuffles = shufflesByEvent.get(occurrence.ganttEventId) ?? [];
        const courseIds =
            shuffles.length > 0
                ? shuffles
                    .map((name) => shuffleCourseId.get(name))
                    .filter((id): id is string => Boolean(id))
                : syllabusCourseIdsByEvent.get(occurrence.ganttEventId) ?? [];

        documents.push(
            buildScheduleEvent(
                occurrence,
                event,
                courseIds,
                moduleHiveIdsByEvent.get(occurrence.ganttEventId) ?? [],
                hiveModuleSubjectById,
                curriculumId,
            ),
        );
    }

    // Only report the Hive failure when it actually cost something: an event
    // that carries a module link but came out with no subject is one that would
    // have resolved a subject had the map loaded (#662). Events with no Hive
    // linkage at all are legitimately `subject: 0` and are not evidence.
    const subjectlessLinkedEvents = hiveModules.unavailable
        ? documents.filter((doc) => doc.subject === 0 && doc.hiveModule !== 0)
            .length
        : 0;

    return {
        ok: true,
        createdCourses,
        documents,
        hiveSubjectsUnavailable: subjectlessLinkedEvents > 0,
        overlaps: countOverlappingOccurrences(plan.occurrences, planInput.events),
        report: plan.report,
    };
}

/**
 * The "plan" half of the plan-then-confirm cut flow.
 *
 * Runs the entire pipeline the commit would run — balance, constraint solve,
 * break pass — against the real iteration settings, and returns what it would
 * do plus every question it could not answer on its own. Writes nothing (no
 * courses are created either), so the dialog can walk the user through the
 * decisions one at a time and only then POST the commit with their answers.
 *
 * Gating mirrors the commit so the dialog never asks questions about a cut that
 * would be refused anyway.
 */
export async function planCurriculumCut(
    curriculumId: GanttCurriculumId,
    options: CutPlanOptions = {},
): Promise<{ ok: false; error: ApiCurriculumCutError } | {
    ok: true;
    result: ApiCurriculumCutPlanResponse;
}> {
    const curriculum = await DbCurriculum.getItem(curriculumId);

    if (curriculum.isDraft) {
        return {
            ok: false,
            error: { code: "draft", message: 'לא ניתן לגזור גאנט טיוטה ללו"ז' },
        };
    }

    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) {
        return {
            ok: false,
            error: {
                code: "no-iteration",
                message: "לא נמצא מחזור המקושר לגאנט זה",
            },
        };
    }

    const materialized = await materializeCurriculumEvents(
        curriculum,
        iteration,
        getDatabaseController(iteration.dbName),
        { ...options, createMissingCourses: false },
    );
    if (!materialized.ok) {
        return {
            ok: true,
            result: { ok: false, errors: materialized.errors },
        };
    }

    return {
        ok: true,
        result: {
            ok: true,
            plannedEvents: materialized.documents.length,
            overlaps: materialized.overlaps,
            report: materialized.report,
        },
    };
}

/**
 * Materialize a published, linked curriculum into schedule events. Any gating
 * violation returns a structured error and writes nothing.
 */
export async function cutCurriculumToSchedule(
    curriculumId: GanttCurriculumId,
    options: CutPlanOptions = {},
    // Who asked for the cut. Every write is meant to be attributable, so an
    // assistant-driven cut must not land in the history as a plain GanttCut
    // (#545 item 3). Defaults to the human-initiated case.
    origin: EventWriteOrigin = { initiator: EventChangeInitiator.GanttCut },
): Promise<CutOutcome> {
    // Throws ClientApiError (→ 400) when the curriculum does not exist.
    const curriculum = await DbCurriculum.getItem(curriculumId);

    if (curriculum.isDraft) {
        return {
            ok: false,
            error: { code: "draft", message: 'לא ניתן לגזור גאנט טיוטה ללו"ז' },
        };
    }

    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) {
        return {
            ok: false,
            error: {
                code: "no-iteration",
                message: "לא נמצא מחזור המקושר לגאנט זה",
            },
        };
    }

    const controller = getDatabaseController(iteration.dbName);

    // One-shot guard: refuse if *this curriculum* already holds cut events in
    // the iteration. Events left behind by a different curriculum linked to the
    // same iteration are not this curriculum's cut and must not block it (#661).
    const existingCut = await countCutEvents(controller, curriculumId);
    if (existingCut > 0) {
        return {
            ok: false,
            error: {
                code: "already-cut",
                count: existingCut,
                message: `הגאנט כבר נגזר ללו"ז (${existingCut} אירועים קיימים)`,
            },
        };
    }

    // This curriculum is uncut, but another curriculum's cut is still live in
    // the same iteration. Cutting on top of it would overlay two schedules that
    // neither curriculum's pull-back could separate again, so refuse with a
    // reason that names the fix (#661).
    const foreign = await findForeignCut(controller, curriculumId);
    if (foreign) {
        return {
            ok: false,
            error: {
                code: "foreign-cut",
                count: foreign.count,
                foreignCurriculumId: foreign.curriculumId,
                message:
                    `המחזור מכיל כבר לו"ז שנגזר מתוכנית לימודים אחרת ` +
                    `(${foreign.count} אירועים). יש למשוך אותו חזרה לפני גזירת תוכנית זו`,
            },
        };
    }

    const materialized = await materializeCurriculumEvents(
        curriculum,
        iteration,
        controller,
        options,
    );
    if (!materialized.ok) {
        return {
            ok: false,
            error: {
                code: "invalid-plan",
                errors: materialized.errors,
                message: "תוכנית הגזירה אינה תקינה",
            },
        };
    }
    const {
        createdCourses,
        documents,
        hiveSubjectsUnavailable,
        overlaps,
        report,
    } = materialized;

    // Idempotency: claim the cut through the ledger's unique index before
    // writing. A second check-then-insert recheck could not deliver the
    // idempotency its comment promised — two concurrent cuts both passed it and
    // both inserted the whole schedule (#515). Here the insert itself decides:
    // exactly one caller wins, the loser sees a duplicate-key error.
    try {
        await controller.curriculumCuts.insertOne({
            claimedAt: new Date(),
            curriculumId,
        });
    } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const claimed = await countCutEvents(controller, curriculumId);
        return {
            ok: false,
            error: {
                code: "already-cut",
                count: claimed,
                message: `הגאנט כבר נגזר ללו"ז (${claimed} אירועים קיימים)`,
            },
        };
    }

    try {
        if (documents.length > 0) {
            await controller.events.insertMany(
                documents as Array<DbEventDocument>,
            );
            await DbEventHistory.recordBulk({
                action: EventChangeAction.Created,
                controller,
                events: documents.map((document) => ({
                    after: document,
                    eventId: document.id,
                })),
                origin: { ...origin, context: { curriculumId } },
            });
            for (const document of documents) {
                syncEventToInstructorsGoogleCalendars(
                    document,
                    "upsert",
                    iteration.id,
                );
            }
            const iterationId = iteration.isCurrent ? undefined : iteration.id;
            SendServerRequestToSessionServer(
                MessageTypes.EVENT_DATA_UPDATE,
                {
                    events: Object.fromEntries(documents.map((d) => [d.id, d])),
                    iterationId,
                } as EventDataUpdateMessage<DbEventDocument>,
                iterationSyncId(iterationId),
            );
        }
    } catch (error) {
        // The claim outlives the process that took it, so a failed cut must
        // release it or the curriculum could never be cut again.
        await controller.curriculumCuts
            .deleteOne({ curriculumId })
            .catch(() => {});
        throw error;
    }

    return {
        ok: true,
        result: {
            createdEvents: documents.length,
            createdCourses,
            hiveSubjectsUnavailable,
            overlaps,
            spilledEvents: report.spills.length,
            spills: report.spills,
            insertedBreaks: report.breaks.length,
        },
    };
}

export type RecreateOccurrenceOutcome =
    | { ok: false; error: { code: string; message: string } }
    | { ok: true; result: { createdEvents: number } };

/**
 * Re-create the schedule event(s) for one gantt-event occurrence that was cut
 * and later deleted from the schedule (#682). Re-runs the full materialization
 * (same computation as a cut/reload) and inserts only the document(s) matching
 * `(ganttEventId, occurrenceDate)`, so the recreated event matches the gantt
 * plan exactly. Refuses when a live event already occupies that occurrence —
 * the caller should delete it first if it wants to replace it.
 */
export async function recreateExecutionOccurrence(
    curriculumId: GanttCurriculumId,
    ganttEventId: string,
    occurrenceDate: string,
): Promise<RecreateOccurrenceOutcome> {
    const curriculum = await DbCurriculum.getItem(curriculumId);
    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) {
        return {
            ok: false,
            error: { code: "no-iteration", message: "לא נמצא מחזור המקושר לגאנט זה" },
        };
    }

    const controller = getDatabaseController(iteration.dbName);

    const alreadyLive = await controller.events.findOne({
        ganttEventId,
        ganttOccurrenceDate: occurrenceDate,
        archived: { $ne: true },
    });
    if (alreadyLive) {
        return {
            ok: false,
            error: {
                code: "already-exists",
                message: "כבר קיים אירוע פעיל למופע זה",
            },
        };
    }

    const materialized = await materializeCurriculumEvents(
        curriculum,
        iteration,
        controller,
        { force: true },
    );
    if (!materialized.ok) {
        return {
            ok: false,
            error: { code: "invalid-plan", message: "תוכנית הגזירה אינה תקינה" },
        };
    }

    const documents = materialized.documents.filter(
        (doc) =>
            doc.ganttEventId === ganttEventId &&
            doc.ganttOccurrenceDate === occurrenceDate,
    );
    if (documents.length === 0) {
        return {
            ok: false,
            error: {
                code: "not-planned",
                message: "המופע אינו קיים עוד בתוכנית הגאנט",
            },
        };
    }

    await controller.events.insertMany(documents as Array<DbEventDocument>);
    await DbEventHistory.recordBulk({
        action: EventChangeAction.Created,
        controller,
        events: documents.map((document) => ({
            after: document,
            eventId: document.id,
        })),
        origin: {
            initiator: EventChangeInitiator.GanttCut,
            context: { curriculumId },
        },
    });
    for (const document of documents) {
        syncEventToInstructorsGoogleCalendars(document, "upsert", iteration.id);
    }
    const iterationId = iteration.isCurrent ? undefined : iteration.id;
    SendServerRequestToSessionServer(
        MessageTypes.EVENT_DATA_UPDATE,
        {
            events: Object.fromEntries(documents.map((d) => [d.id, d])),
            iterationId,
        } as EventDataUpdateMessage<DbEventDocument>,
        iterationSyncId(iterationId),
    );

    return { ok: true, result: { createdEvents: documents.length } };
}

/**
 * Report whether a curriculum has live cut events in its linked iteration.
 * `cut: false` when there is no linked iteration or every cut event was already
 * pulled back (archived) — either way there is nothing to pull back.
 */
export async function getCutStatus(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumCutStatus> {
    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) return { cut: false, count: 0 };

    const controller = getDatabaseController(iteration.dbName);
    const count = await countCutEvents(controller, curriculumId);
    return { cut: count > 0, count };
}

/**
 * Soft-delete every live schedule event generated by a previous cut of this
 * curriculum ("משיכה חזרה"). Archived events are preserved (auditing/restore)
 * but drop out of every read path, and each removal is broadcast so connected
 * calendars update in real time. Idempotency: a curriculum with no live cut
 * events returns a `not-cut` error and writes nothing.
 */
export async function pullBackCutSchedule(
    curriculumId: GanttCurriculumId,
): Promise<PullBackOutcome> {
    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) {
        return {
            ok: false,
            error: {
                code: "no-iteration",
                message: "לא נמצא מחזור המקושר לגאנט זה",
            },
        };
    }

    const controller = getDatabaseController(iteration.dbName);

    // Only live cut events are eligible; already-archived ones are left as-is.
    // Only the ids are used (the archive is an updateMany, the history rows key
    // off eventId), so do not drag every full document over the wire (#538
    // item 8).
    // Scoped to this curriculum's own cut events — pulling back a curriculum
    // must not archive the events another curriculum cut into the same
    // iteration (#661).
    const liveCutEvents = await controller.events
        .find(cutEventFilter(curriculumId), {
            projection: { id: 1, _id: 0 },
        })
        .toArray();

    if (liveCutEvents.length === 0) {
        return {
            ok: false,
            error: {
                code: "not-cut",
                message: 'לא נמצאו אירועים שנגזרו ללו"ז עבור גאנט זה',
            },
        };
    }

    await controller.events.updateMany(cutEventFilter(curriculumId), {
        $set: { archived: true },
    });

    // Pulling back is what makes the curriculum cuttable again, so the one-shot
    // claim has to be released with the events (#515).
    await controller.curriculumCuts.deleteOne({ curriculumId });

    await DbEventHistory.recordBulk({
        action: EventChangeAction.Archived,
        controller,
        events: liveCutEvents.map((event) => ({ eventId: event.id })),
        origin: {
            context: { curriculumId },
            initiator: EventChangeInitiator.GanttPullBack,
        },
    });

    // Broadcast one removal per event so connected calendars drop them, mirroring
    // the single-event soft-delete path (db-event.deleteDbEvent).
    const iterationId = iteration.isCurrent ? undefined : iteration.id;
    for (const event of liveCutEvents) {
        SendServerRequestToSessionServer(
            MessageTypes.EVENT_ADDED_OR_REMOVED,
            {
                action: "removed",
                eventId: event.id,
                iterationId,
            } as EventAddedOrRemovedMessage<DbEventDocument>,
            iterationSyncId(iterationId),
        );
    }

    return { ok: true, result: { removedEvents: liveCutEvents.length } };
}
