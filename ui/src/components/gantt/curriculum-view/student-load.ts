import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { isShuffleCourse } from "@/api-shared/course-tree";
import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import { Course } from "@/api-shared/types/course";
import {
    EventRecurrence,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventRecurrenceException,
    GanttSyllabusId,
    getAllowedDayIndices,
} from "@/api-shared/types/gantt/models";
import { isBreakEvent } from "@/api-shared/types/settings/meal";
import {
    computeEventDaySpans,
    DayHeadroom,
    EventDaySpan,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    countEventOccurrences,
    RecurrenceOccurrenceContext,
} from "@/components/gantt/utils";

/*
 * Scheduled time is the time a single student spends in events. A student
 * walks one root-to-leaf path of the course tree (Bis90 → Apollo → …) and sits
 * in exactly one shuffle of every syllabus on that path. So:
 *
 * - syllabuses on exclusive branches (Apollo vs Sphinx) run in parallel;
 * - a syllabus's shuffles run in parallel inside one shared block, so the
 *   syllabus takes its longest shuffle, and unequal shuffles are an issue;
 * - an event limited to some courses counts only on those courses' paths;
 * - a day's scheduled time is its busiest path; courses need not match each
 *   other, only the shuffles of one syllabus must.
 *
 * Prayers are not gantt events: they run alongside anything and add nothing.
 */

/** One kind of student: a root-to-leaf chain through the course tree. */
export type StudentPath = {
    id: string;
    /** Course ids from the root down to the leaf; empty when no courses exist. */
    courseIds: Array<string>;
    /** Display name — the chain below the root, e.g. "אפולו › צוות א". */
    label: string;
};

export type StudentLoadIssue = {
    kind: "shuffles-misaligned";
    syllabusId: GanttSyllabusId;
    /** Minutes each of the syllabus' shuffles has on the day. */
    minutesByShuffle: Record<string, number>;
};

export type PathDayLoad = {
    pathId: string;
    minutes: number;
    /** Of `minutes`, the time in break events (meals…). */
    breakMinutes: number;
    /** Minutes per syllabus on this path, largest first. */
    bySyllabus: Array<{ syllabusId: GanttSyllabusId; minutes: number }>;
};

export type DayStudentLoad = {
    /** The busiest path's minutes — the day's scheduled time. */
    minutes: number;
    /** Break time on the day (the busiest path's) — what "ignore breaks" removes. */
    breakMinutes: number;
    paths: Array<PathDayLoad>;
    issues: Array<StudentLoadIssue>;
};

export type StudentSchedule = {
    paths: Array<StudentPath>;
    spans: Record<string, EventDaySpan>;
    byDay: Record<GanttDayId, DayStudentLoad>;
};

type Audience = {
    syllabusId: GanttSyllabusId;
    pathIdxs: Array<number>;
    /** Shuffles the event is for; null ⇒ every student of its paths. */
    shuffles: Array<string> | null;
    isBreak: boolean;
};
/** A syllabus' minutes on one day: shared minutes plus per-shuffle minutes. */
type Slot = { common: number; byShuffle: Map<string, number> };

const ALL_STUDENTS_LABEL = "כל החניכים";

function slotMax(slot: Slot): number {
    let max = 0;
    for (const minutes of slot.byShuffle.values()) max = Math.max(max, minutes);
    return max;
}

function slotMinutes(slot: Slot): number {
    return slot.common + slotMax(slot);
}

function slotOf<K>(map: Map<K, Slot>, key: K): Slot {
    let slot = map.get(key);
    if (!slot) {
        slot = { common: 0, byShuffle: new Map() };
        map.set(key, slot);
    }
    return slot;
}

/**
 * The student paths a curriculum's syllabuses and events distinguish: every
 * root-to-leaf chain of the course tree, cut at the deepest course anything
 * is assigned to. A course's students are split between all of its
 * sub-courses, so once one sub-course matters its siblings are paths too.
 * Shuffle courses are not paths — shuffles live inside a syllabus. Without
 * any course, there is a single all-students path.
 */
export function buildStudentPaths(
    courses: Array<Pick<Course, "description" | "id" | "name" | "parentId">>,
    assignedCourseIds: Iterable<string>,
    /** Something is assigned to no course, i.e. to the root. */
    includeRoots: boolean,
): Array<StudentPath> {
    const tree = courses.filter((course) => !isShuffleCourse(course));
    const byId = new Map(tree.map((course) => [course.id, course]));
    const parentOf = (id: string) => {
        const parentId = byId.get(id)?.parentId;
        return parentId && byId.has(parentId) ? parentId : null;
    };

    const relevant = new Set<string>();
    for (const id of assignedCourseIds) {
        for (let cur: null | string = byId.has(id) ? id : null; cur && !relevant.has(cur); cur = parentOf(cur)) {
            relevant.add(cur);
        }
    }
    if (includeRoots) {
        for (const course of tree) {
            if (!parentOf(course.id)) relevant.add(course.id);
        }
    }
    if (relevant.size === 0) {
        return [{ id: "all", courseIds: [], label: ALL_STUDENTS_LABEL }];
    }

    const hasRelevantChild = new Set<string>();
    for (const id of relevant) {
        const parentId = parentOf(id);
        if (parentId) hasRelevantChild.add(parentId);
    }
    for (const course of tree) {
        const parentId = parentOf(course.id);
        if (parentId && hasRelevantChild.has(parentId)) relevant.add(course.id);
    }

    return tree
        .filter((course) => relevant.has(course.id) && !hasRelevantChild.has(course.id))
        .map((leaf) => {
            const chain: Array<string> = [];
            for (let cur: null | string = leaf.id; cur && !chain.includes(cur); cur = parentOf(cur)) {
                chain.unshift(cur);
            }
            const named = chain.length > 1 ? chain.slice(1) : chain;
            return {
                id: leaf.id,
                courseIds: chain,
                label: named.map((id) => byId.get(id)?.name ?? "").join(" › "),
            };
        });
}

/** Which paths and shuffles attend each event of the given syllabuses. */
function resolveAudiences(
    state: NormalizedStore,
    syllabusIds: Array<GanttSyllabusId>,
    paths: Array<StudentPath>,
): Map<string, Audience> {
    const pathIdxsFor = (courseIds: Array<string>) => {
        const known = courseIds.filter((id) =>
            paths.some((path) => path.courseIds.includes(id)),
        );
        // No (known) course ⇒ the root ⇒ every student.
        if (known.length === 0) return paths.map((_, idx) => idx);
        return paths.flatMap((path, idx) =>
            known.some((id) => path.courseIds.includes(id)) ? [idx] : [],
        );
    };

    const audiences = new Map<string, Audience>();
    for (const syllabusId of syllabusIds) {
        const syllabus = state.syllabuses[syllabusId];
        if (!syllabus) continue;
        const syllabusPaths = pathIdxsFor(syllabus.courseIds ?? []);
        const syllabusShuffles = syllabus.shuffles ?? [];
        for (const moduleId of syllabus.modules ?? []) {
            const moduleDoc = state.modules[moduleId];
            if (!moduleDoc) continue;
            for (const eventId of moduleDoc.events ?? []) {
                const event = state.events[eventId];
                if (!event) continue;
                const courseIds = event.courseIds ?? [];
                const isBreak = isBreakEvent(syllabus.title, event.title);
                if (courseIds.length > 0) {
                    audiences.set(eventId, {
                        syllabusId,
                        pathIdxs: pathIdxsFor(courseIds),
                        shuffles: null,
                        isBreak,
                    });
                    continue;
                }
                const tagged = (event.shuffles?.length ? event.shuffles : moduleDoc.shuffles) ?? [];
                const shuffles = tagged.filter((name) => syllabusShuffles.includes(name));
                audiences.set(eventId, {
                    syllabusId,
                    pathIdxs: syllabusPaths,
                    isBreak,
                    // Tagged for every shuffle (or the syllabus has just one)
                    // is the same as tagged for none.
                    shuffles:
                        syllabusShuffles.length > 1 &&
                        shuffles.length > 0 &&
                        shuffles.length < syllabusShuffles.length
                            ? shuffles
                            : null,
                });
            }
        }
    }
    return audiences;
}

/** Accumulates per-day, per-path, per-syllabus minutes as events are placed. */
class StudentLoadTracker implements DayHeadroom {
    private readonly days = new Map<GanttDayId, Map<number, Map<GanttSyllabusId, Slot>>>();
    /** Path-independent view of each syllabus' shuffles, for alignment. */
    private readonly shuffleSlots = new Map<GanttDayId, Map<GanttSyllabusId, Slot>>();
    /** Break minutes per day, per path index. */
    private readonly breaks = new Map<GanttDayId, Map<number, number>>();

    constructor(private readonly audiences: Map<string, Audience>) {}

    private pathSlots(dayId: GanttDayId, pathIdx: number) {
        let day = this.days.get(dayId);
        if (!day) {
            day = new Map();
            this.days.set(dayId, day);
        }
        let slots = day.get(pathIdx);
        if (!slots) {
            slots = new Map();
            day.set(pathIdx, slots);
        }
        return slots;
    }

    private pathMinutes(dayId: GanttDayId, pathIdx: number): number {
        let total = 0;
        for (const slot of this.pathSlots(dayId, pathIdx).values()) total += slotMinutes(slot);
        return total;
    }

    consume(dayId: GanttDayId, eventId: string, minutes: number): void {
        const audience = this.audiences.get(eventId);
        if (!audience || minutes <= 0) return;
        const add = (slot: Slot) => {
            if (!audience.shuffles) {
                slot.common += minutes;
                return;
            }
            for (const name of audience.shuffles) {
                slot.byShuffle.set(name, (slot.byShuffle.get(name) ?? 0) + minutes);
            }
        };
        for (const pathIdx of audience.pathIdxs) {
            add(slotOf(this.pathSlots(dayId, pathIdx), audience.syllabusId));
            if (audience.isBreak) {
                const day = this.breaks.get(dayId) ?? new Map<number, number>();
                day.set(pathIdx, (day.get(pathIdx) ?? 0) + minutes);
                this.breaks.set(dayId, day);
            }
        }
        if (audience.shuffles) {
            let bySyllabus = this.shuffleSlots.get(dayId);
            if (!bySyllabus) {
                bySyllabus = new Map();
                this.shuffleSlots.set(dayId, bySyllabus);
            }
            add(slotOf(bySyllabus, audience.syllabusId));
        }
    }

    summarize(state: NormalizedStore, paths: Array<StudentPath>): Record<GanttDayId, DayStudentLoad> {
        const byDay: Record<GanttDayId, DayStudentLoad> = {};
        const dayIds = new Set([...this.days.keys(), ...this.shuffleSlots.keys()]);
        for (const dayId of dayIds) {
            const pathLoads: Array<PathDayLoad> = paths.map((path, pathIdx) => {
                const bySyllabus = [...(this.days.get(dayId)?.get(pathIdx) ?? new Map<GanttSyllabusId, Slot>())]
                    .map(([syllabusId, slot]) => ({ syllabusId, minutes: slotMinutes(slot) }))
                    .filter((entry) => entry.minutes > 0)
                    .sort((a, b) => b.minutes - a.minutes);
                return {
                    pathId: path.id,
                    minutes: bySyllabus.reduce((sum, entry) => sum + entry.minutes, 0),
                    breakMinutes: this.breaks.get(dayId)?.get(pathIdx) ?? 0,
                    bySyllabus,
                };
            });

            const issues: Array<StudentLoadIssue> = [];
            for (const [syllabusId, slot] of this.shuffleSlots.get(dayId) ?? []) {
                const names = state.syllabuses[syllabusId]?.shuffles ?? [];
                const minutesByShuffle = Object.fromEntries(
                    names.map((name) => [name, slot.byShuffle.get(name) ?? 0]),
                );
                if (new Set(Object.values(minutesByShuffle)).size > 1) {
                    issues.push({ kind: "shuffles-misaligned", syllabusId, minutesByShuffle });
                }
            }

            byDay[dayId] = {
                minutes: Math.max(0, ...pathLoads.map((load) => load.minutes)),
                breakMinutes: Math.max(0, ...pathLoads.map((load) => load.breakMinutes)),
                paths: pathLoads,
                issues,
            };
        }
        return byDay;
    }
}

/**
 * Every course id a curriculum's syllabuses and their events are assigned to,
 * and whether some syllabus has none (⇒ it is the root's, i.e. everyone's).
 */
function assignedCourseIds(
    state: NormalizedStore,
    syllabusIds: Array<GanttSyllabusId>,
    knownIds: Set<string>,
): { ids: Set<string>; includeRoots: boolean } {
    const ids = new Set<string>();
    let includeRoots = false;
    for (const syllabusId of syllabusIds) {
        const syllabus = state.syllabuses[syllabusId];
        if (!syllabus) continue;
        const own = (syllabus.courseIds ?? []).filter((id) => knownIds.has(id));
        if (own.length === 0) includeRoots = true;
        for (const id of own) ids.add(id);
        for (const moduleId of syllabus?.modules ?? []) {
            for (const eventId of state.modules[moduleId]?.events ?? []) {
                for (const id of state.events[eventId]?.courseIds ?? []) ids.add(id);
            }
        }
    }
    return { ids, includeRoots };
}

/**
 * Calls `visit` once per recurrence echo of every mapped recurring event (its
 * start day excluded), with its root mapping's allotted minutes. Skipped and materialized
 * occurrences are left out.
 */
export function forEachRecurrenceOccurrence(
    {
        dateOf,
        exceptions,
        linearDays,
        mappings,
        state,
    }: {
        dateOf?: (dayId: GanttDayId) => string | undefined;
        exceptions: Record<string, GanttEventRecurrenceException>;
        linearDays: Array<GanttDayId>;
        mappings: Record<string, GanttCurriculumModuleDayMapping>;
        state: NormalizedStore;
    },
    visit: (dayId: GanttDayId, eventId: string, minutes: number) => void,
): void {
    const excludedByEvent = new Map<string, Set<string>>();
    for (const exception of Object.values(exceptions)) {
        const excluded = excludedByEvent.get(exception.eventId) ?? new Set();
        excluded.add(exception.dayId);
        excludedByEvent.set(exception.eventId, excluded);
    }
    // A recurring event echoes from its earliest mapping, for that mapping's
    // allotted minutes; its other mappings are standalone parts.
    const dayOrder = new Map(linearDays.map((dayId, i) => [dayId, i]));
    const rootByEvent = new Map<string, GanttCurriculumModuleDayMapping>();
    for (const mapping of Object.values(mappings)) {
        if (!mapping.eventId || !dayOrder.has(mapping.dayId)) continue;
        const root = rootByEvent.get(mapping.eventId);
        if (!root || (dayOrder.get(mapping.dayId) ?? 0) < (dayOrder.get(root.dayId) ?? 0)) {
            rootByEvent.set(mapping.eventId, mapping);
        }
    }
    for (const mapping of rootByEvent.values()) {
        if (!mapping.eventId) continue;
        const event = state.events[mapping.eventId];
        if (!event || event.recurrence === EventRecurrence.None) continue;
        const occurrenceDayIds = getRecurrenceOccurrenceDayIds({
            recurrence: event.recurrence,
            startDayId: mapping.dayId,
            linearDays,
            dayIndexOf: (dayId) => state.days[dayId]?.dayIndex,
            excludedDayIds: excludedByEvent.get(mapping.eventId),
            recurrenceStartDate: event.recurrenceStartDate,
            recurrenceEndDate: event.recurrenceEndDate,
            dateOf,
            allowedDayIndices: getAllowedDayIndices(event.constraints),
        });
        for (const dayId of occurrenceDayIds) {
            visit(dayId, mapping.eventId, mapping.allottedMinutes ?? 0);
        }
    }
}

/**
 * Minutes each event is allotted in a curriculum: every one of its mappings'
 * allotted minutes, plus each surviving recurrence echo at its earliest
 * mapping's. The single read path for an event's scheduled time; 0 means
 * the event is documented but not part of the curriculum.
 */
export function sumAllottedMinutesByEvent(ctx: {
    dateOf?: (dayId: GanttDayId) => string | undefined;
    exceptions: Record<string, GanttEventRecurrenceException>;
    linearDays: Array<GanttDayId>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
}): Map<string, number> {
    const totals = new Map<string, number>();
    const add = (_dayId: GanttDayId, eventId: string, minutes: number) =>
        totals.set(eventId, (totals.get(eventId) ?? 0) + minutes);
    for (const mapping of Object.values(ctx.mappings)) {
        if (mapping.eventId) add(mapping.dayId, mapping.eventId, mapping.allottedMinutes ?? 0);
    }
    forEachRecurrenceOccurrence(ctx, add);
    return totals;
}

/**
 * Lays out every mapped event (spillover by what its own students have left
 * on a day) and totals each day per student path. Recurring events count as
 * if materialized on every occurrence, and are placed before anything spills.
 */
export function computeStudentSchedule({
    courses,
    dateOf,
    exceptions,
    linearDays,
    mappings,
    state,
    syllabusIds,
}: {
    courses: Array<Course>;
    /** Calendar date of a day, for recurrence windows (#468). */
    dateOf?: (dayId: GanttDayId) => string | undefined;
    exceptions: Record<string, GanttEventRecurrenceException>;
    linearDays: Array<GanttDayId>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
    syllabusIds: Array<GanttSyllabusId>;
}): StudentSchedule {
    const tree = courses.filter((course) => !isShuffleCourse(course));
    const assigned = assignedCourseIds(state, syllabusIds, new Set(tree.map((course) => course.id)));
    const paths = buildStudentPaths(tree, assigned.ids, assigned.includeRoots);
    const tracker = new StudentLoadTracker(resolveAudiences(state, syllabusIds, paths));

    forEachRecurrenceOccurrence({ dateOf, exceptions, linearDays, mappings, state }, (dayId, eventId, minutes) =>
        tracker.consume(dayId, eventId, minutes),
    );

    const spans = computeEventDaySpans({ mappings, state, linearDays, load: tracker });
    return { paths, spans, byDay: tracker.summarize(state, paths) };
}

/**
 * Scheduled minutes over a set of days: each path's total, and the busiest
 * path's. A student's week is the sum of their days, not of the busiest days.
 */
export function sumStudentMinutes(
    byDay: Record<GanttDayId, DayStudentLoad>,
    dayIds: Iterable<GanttDayId>,
): number {
    const byPath = new Map<string, number>();
    for (const dayId of dayIds) {
        for (const load of byDay[dayId]?.paths ?? []) {
            byPath.set(load.pathId, (byPath.get(load.pathId) ?? 0) + load.minutes);
        }
    }
    return Math.max(0, ...byPath.values());
}

/** The loads with break time taken out of every path and day. */
export function withoutBreaks(
    byDay: Record<GanttDayId, DayStudentLoad>,
): Record<GanttDayId, DayStudentLoad> {
    return Object.fromEntries(
        Object.entries(byDay).map(([dayId, load]) => {
            const paths = load.paths.map((path) => ({
                ...path,
                minutes: path.minutes - path.breakMinutes,
                breakMinutes: 0,
            }));
            return [dayId, { ...load, paths, minutes: Math.max(0, ...paths.map((path) => path.minutes)) }];
        }),
    );
}

/** Per-day busiest-path minutes, the shape the capacity views consume. */
export function getStudentMinutesByDay(
    byDay: Record<GanttDayId, DayStudentLoad>,
): Record<GanttDayId, number> {
    return Object.fromEntries(
        Object.entries(byDay).map(([dayId, load]) => [dayId, load.minutes]),
    );
}

/**
 * The time each kind of student spends in the given syllabuses' events: per
 * path, each syllabus at its longest shuffle plus the course-limited events
 * on that path. Recurring events count per occurrence when `occurrenceCtx` is
 * given. `include` narrows the events counted (a module, the placed
 * events…) without changing who the students are.
 */
export function calculateStudentMinutesByPath({
    courses,
    include,
    occurrenceCtx,
    state,
    syllabusIds,
}: {
    courses: Array<Course>;
    include?: (eventId: string, moduleId: string) => boolean;
    occurrenceCtx?: RecurrenceOccurrenceContext;
    state: NormalizedStore;
    syllabusIds: Array<GanttSyllabusId>;
}): Array<{ path: StudentPath; minutes: number }> {
    const tree = courses.filter((course) => !isShuffleCourse(course));
    const assigned = assignedCourseIds(state, syllabusIds, new Set(tree.map((course) => course.id)));
    const paths = buildStudentPaths(tree, assigned.ids, assigned.includeRoots);
    const tracker = new StudentLoadTracker(resolveAudiences(state, syllabusIds, paths));
    // Everything as one "day": the tracker's per-path sums are exactly the
    // per-student totals.
    const ALL = "all";
    for (const syllabusId of syllabusIds) {
        for (const moduleId of state.syllabuses[syllabusId]?.modules ?? []) {
            for (const eventId of state.modules[moduleId]?.events ?? []) {
                const event = state.events[eventId];
                if (!event || (include && !include(eventId, moduleId))) continue;
                const occurrences = countEventOccurrences(event, eventId, state, occurrenceCtx);
                tracker.consume(ALL, eventId, (event.minimumDuration ?? 0) * occurrences);
            }
        }
    }
    const loads = tracker.summarize(state, paths)[ALL]?.paths ?? [];
    return paths.map((path, idx) => ({ path, minutes: loads[idx]?.minutes ?? 0 }));
}

/** `calculateStudentMinutesByPath`'s busiest path — one student's time. */
export function calculateStudentMinutes(
    args: Parameters<typeof calculateStudentMinutesByPath>[0],
): number {
    return Math.max(0, ...calculateStudentMinutesByPath(args).map((entry) => entry.minutes));
}

/** One student's minimum time in a module, recurring events per occurrence. */
export function calculateStudentModuleMinutes(
    moduleId: string,
    state: NormalizedStore,
    courses: Array<Course>,
    occurrenceCtx?: RecurrenceOccurrenceContext,
    ignoreBreaks = false,
): number {
    const syllabusId = state.modules[moduleId]?.syllabusId;
    if (!syllabusId) return 0;
    const syllabusTitle = state.syllabuses[syllabusId]?.title ?? "";
    return calculateStudentMinutes({
        courses,
        include: (eventId, eventModuleId) =>
            eventModuleId === moduleId
            && !(ignoreBreaks && isBreakEvent(syllabusTitle, state.events[eventId]?.title ?? "")),
        occurrenceCtx,
        state,
        syllabusIds: [syllabusId],
    });
}

/** One student's minimum time in a syllabus, recurring events per occurrence. */
export function calculateStudentSyllabusMinutes(
    syllabusId: GanttSyllabusId,
    state: NormalizedStore,
    courses: Array<Course>,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateStudentMinutes({ courses, occurrenceCtx, state, syllabusIds: [syllabusId] });
}

/**
 * One student's time in the modules placed whole (tentatively) on the
 * timeline, each module counted once however many days it is mapped to.
 */
export function calculateStudentTentativeMinutes({
    courses,
    mappings,
    moduleIds,
    state,
}: {
    courses: Array<Course>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    moduleIds: Iterable<string>;
    state: NormalizedStore;
}): number {
    const wanted = new Set(moduleIds);
    const placed = new Set<string>();
    for (const mapping of Object.values(mappings)) {
        if (wanted.has(mapping.moduleId)) placed.add(mapping.moduleId);
    }
    const syllabusIds = [...new Set(
        [...placed].flatMap((moduleId) => state.modules[moduleId]?.syllabusId ?? []),
    )];
    return calculateStudentMinutes({
        courses,
        include: (_eventId, moduleId) => placed.has(moduleId),
        state,
        syllabusIds,
    });
}
