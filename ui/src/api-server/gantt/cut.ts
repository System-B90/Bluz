import { randomUUID } from "crypto";

import { DbCourses } from "@/api-server/db-courses";
import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import {
    DatabaseController,
    getDatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import {
    CutPlanInput,
    CutValidationError,
    PlannedOccurrence,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from "@/api-shared/types";
import { Course } from "@/api-shared/types/course";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import {
    ApiCurriculumCutError,
    ApiCurriculumCutPreviewResponse,
    ApiCurriculumCutResponse,
    ApiCurriculumCutStatus,
    ApiCurriculumPullBackError,
    ApiCurriculumPullBackResponse,
    ApiCutPreviewOccurrence,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId, ModuleEventType } from "@/api-shared/types/gantt/models";
import {
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
    SCHEDULE_SETTINGS_KEY,
    ScheduleSettings,
} from "@/api-shared/types/settings/schedule";
import { MessageTypes } from "@/settings";

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

/**
 * Walk the full curriculum tree once, indexing every event by id and recording
 * the title of the syllabus each event lives under (used as course provenance).
 */
export function indexCurriculumEvents(curriculum: ApiCurriculum): {
    eventsById: Map<string, ApiModuleEvent>;
    syllabusTitleByEvent: Map<string, string>;
} {
    const eventsById = new Map<string, ApiModuleEvent>();
    const syllabusTitleByEvent = new Map<string, string>();

    for (const cLink of curriculum.c2s ?? []) {
        const syllabus = cLink.syllabus;
        for (const sLink of syllabus.s2m ?? []) {
            for (const mLink of sLink.module.m2e ?? []) {
                const event = mLink.event;
                eventsById.set(event.id, event);
                syllabusTitleByEvent.set(event.id, syllabus.title);
            }
        }
    }

    return { eventsById, syllabusTitleByEvent };
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
}): CutPlanInput {
    const { curriculum, mappings, exceptions, dayStartTime, weekendHomeStartTime } = args;

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
            };
            return dLink.day.id;
        });
        return {
            id: wLink.week.id,
            dayIds,
            weekendDuty: wLink.week.weekendDuty ?? true,
        };
    });

    const { eventsById } = indexCurriculumEvents(curriculum);
    const events = Array.from(eventsById.values()).map((event) => ({
        id: event.id,
        title: event.title,
        recurrence: event.recurrence,
        minimumDuration: event.minimumDuration,
        allocatedDuration: event.cEC?.[0]?.allocatedDuration ?? 0,
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
    };
}

/**
 * Number of overlapping pairs of occurrences: two occurrences on the same date
 * whose time ranges intersect. Purely informational for the cut summary.
 */
export function countOverlappingOccurrences(
    occurrences: Array<PlannedOccurrence>,
): number {
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
 * source gantt event. Hive linkage is copied when present; when absent the
 * event is stored as a non-Hive placeholder (subject/module 0, lesson null),
 * matching how "fake" events represent "no Hive linkage".
 */
export function buildScheduleEvent(
    occurrence: PlannedOccurrence,
    ganttEvent: ApiModuleEvent,
    courseIds: Array<string>,
): DbEventDocument {
    return {
        id: randomUUID(),
        name: ganttEvent.title,
        type: moduleEventTypeToCalendarType(ganttEvent.type),
        subject: ganttEvent.hiveSubjectId ?? 0,
        hiveModule: ganttEvent.hiveModuleId ?? 0,
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
        locked: false,
        hidden: false,
        required: false,
        personalTalk: false,
        ganttEventId: ganttEvent.id,
        ganttOccurrenceDate: occurrence.occurrenceDate,
    };
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
): Promise<ApiCurriculumCutPreviewResponse> {
    const curriculum = await DbCurriculum.getItem(curriculumId);

    const [mappings, exceptions, iteration] = await Promise.all([
        getModuleDayMappingsForCurriculum(curriculumId, {}),
        listRecurrenceExceptionsForCurriculum(curriculumId),
        DbIterations.getByCurriculum(curriculumId),
    ]);

    let scheduleSetting: null | ScheduleSettings = null;
    if (iteration) {
        const controller = getDatabaseController(iteration.dbName);
        scheduleSetting = (await DbSettings.get(
            SCHEDULE_SETTINGS_KEY,
            undefined,
            controller,
        )) as null | ScheduleSettings;
    }
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
    });

    // Preview is tolerant where the real cut is strict: per-event problems
    // (unmapped / unsatisfied recurrence) skip just that event and re-plan
    // instead of failing the whole preview. Only a missing start date — which
    // makes every occurrence undatable — is fatal.
    let plan = planCut(planInput);
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
        plan = planCut({
            ...planInput,
            events: planInput.events.filter(
                (event) => !skippedEventIds.has(event.id),
            ),
        });
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
            return {
                ganttEventId: occ.ganttEventId,
                title: ganttEvent?.title ?? occ.ganttEventId,
                eventType: ganttEvent?.type ?? ModuleEventType.Other,
                hiveSubjectId: ganttEvent?.hiveSubjectId ?? null,
                syllabusTitle: syllabusTitleByEvent.get(occ.ganttEventId) ?? "",
                moduleTitle: moduleTitleByEvent.get(occ.ganttEventId) ?? "",
                occurrenceDate: occ.occurrenceDate,
                startTime: occ.startTime.toISOString(),
                endTime: occ.endTime.toISOString(),
                isRecurrenceEcho: occ.isRecurrenceEcho,
            };
        },
    );

    return {
        ok: true,
        occurrences,
        overlaps: countOverlappingOccurrences(plan.occurrences),
        skipped,
    };
}

/** Count of already-cut, live events in the target iteration DB. */
async function countCutEvents(
    controller: DatabaseController,
): Promise<number> {
    // Cut events always store a string `ganttEventId`; `$exists` alone
    // identifies them. Archived (soft-deleted) events do not count.
    return await controller.events.countDocuments({
        ganttEventId: { $exists: true },
        archived: { $ne: true },
    });
}

/**
 * Materialize a published, linked curriculum into schedule events. Any gating
 * violation returns a structured error and writes nothing.
 */
export async function cutCurriculumToSchedule(
    curriculumId: GanttCurriculumId,
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

    // One-shot guard: refuse if this iteration already holds cut events.
    const existingCut = await countCutEvents(controller);
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

    const [mappings, exceptions, scheduleSetting] = await Promise.all([
        getModuleDayMappingsForCurriculum(curriculumId, {}),
        listRecurrenceExceptionsForCurriculum(curriculumId),
        DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, controller),
    ]);
    const dayStartTime =
        (scheduleSetting as null | ScheduleSettings)?.dayStartTime ??
        DEFAULT_DAY_START_TIME;
    const weekendHomeStartTime =
        (scheduleSetting as null | ScheduleSettings)?.weekendHomeStartTime ??
        DEFAULT_WEEKEND_HOME_START_TIME;

    const { eventsById, syllabusTitleByEvent } =
        indexCurriculumEvents(curriculum);

    const planInput = buildCutPlanInput({
        curriculum,
        mappings: mappings as Array<CutMappingRow>,
        exceptions: exceptions as Array<CutExceptionRow>,
        dayStartTime,
        weekendHomeStartTime,
    });
    const plan = planCut(planInput);
    if (!plan.ok) {
        return {
            ok: false,
            error: {
                code: "invalid-plan",
                errors: plan.errors,
                message: "תוכנית הגזירה אינה תקינה",
            },
        };
    }

    // Resolve / create courses for the shuffles referenced by cut events.
    const cutEventIds = new Set(
        plan.occurrences.map((occ) => occ.ganttEventId),
    );
    const shuffleNames = new Set<string>();
    const syllabusTitleForShuffle = new Map<string, string>();
    for (const eventId of cutEventIds) {
        const event = eventsById.get(eventId);
        for (const name of event?.shuffles ?? []) {
            shuffleNames.add(name);
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
            const course: Course = {
                id: randomUUID(),
                name,
                color: null,
                description: `נגזר מסילבוס "${syllabusTitleForShuffle.get(name) ?? ""}"`,
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
        const event = eventsById.get(occurrence.ganttEventId);
        if (!event) continue;

        const courseIds =
            event.shuffles && event.shuffles.length > 0
                ? event.shuffles
                    .map((name) => shuffleCourseId.get(name))
                    .filter((id): id is string => Boolean(id))
                : allCourseIds;

        documents.push(buildScheduleEvent(occurrence, event, courseIds));
    }

    // Idempotency: re-check the one-shot guard immediately before writing so a
    // concurrent cut cannot double-insert.
    const recheck = await countCutEvents(controller);
    if (recheck > 0) {
        return {
            ok: false,
            error: {
                code: "already-cut",
                count: recheck,
                message: `הגאנט כבר נגזר ללו"ז (${recheck} אירועים קיימים)`,
            },
        };
    }

    if (documents.length > 0) {
        await controller.events.insertMany(documents as Array<DbEventDocument>);
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            events: Object.fromEntries(documents.map((d) => [d.id, d])),
            iterationId: iteration.isCurrent ? undefined : iteration.id,
        } as EventDataUpdateMessage<DbEventDocument>);
    }

    return {
        ok: true,
        result: {
            createdEvents: documents.length,
            createdCourses,
            overlaps: countOverlappingOccurrences(plan.occurrences),
        },
    };
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
    const count = await countCutEvents(controller);
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
    const liveCutEvents = await controller.events
        .find({ ganttEventId: { $exists: true }, archived: { $ne: true } })
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

    await controller.events.updateMany(
        { ganttEventId: { $exists: true }, archived: { $ne: true } },
        { $set: { archived: true } },
    );

    // Broadcast one removal per event so connected calendars drop them, mirroring
    // the single-event soft-delete path (db-event.deleteDbEvent).
    for (const event of liveCutEvents) {
        SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
            action: "removed",
            eventId: event.id,
            iterationId: iteration.isCurrent ? undefined : iteration.id,
        } as EventAddedOrRemovedMessage<DbEventDocument>);
    }

    return { ok: true, result: { removedEvents: liveCutEvents.length } };
}
