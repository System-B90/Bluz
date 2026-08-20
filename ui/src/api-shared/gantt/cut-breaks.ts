import {
    BREAK_PLACEMENT_RULES,
    BREAK_RULES,
    BreakKind,
    LONG_EXERCISE_THRESHOLD_MINUTES,
    LONG_EXERCISE_TYPES,
    MIN_LECTURE_MINUTES_FOR_POST_BREAK,
    POST_LECTURE_RUN_TYPES,
    PRAYER_RULES,
    roomKeyOf,
} from "@/api-shared/gantt/cut-rules";
import { ModuleEventType } from "@/api-shared/types/gantt/models/event";

/**
 * Break post-pass for the cut ("פיזור הפסקות").
 *
 * Runs after events have been placed on their final days and times. Its whole
 * job is to take a day's leftover slack — the empty tail that would otherwise
 * sit at the end of the day — and spread it through the day as deliberate
 * breaks, in the priority order defined by `cut-rules.ts`.
 *
 * Pure and minute-domain: the caller supplies minute-of-day numbers and gets
 * minute-of-day numbers back, so the planner keeps sole ownership of timezone
 * arithmetic.
 */

/** One already-placed item on a day, in minutes-of-day. */
export type PlacedItem = {
    /** Stable key matching the planner's slot key. */
    key: string;
    startMinutes: number;
    endMinutes: number;
    eventType: ModuleEventType;
    /** Syllabus the event belongs to; drives the between-syllabuses rule. */
    syllabusId: null | string;
    /** Room name once the cut assigns rooms; null today. */
    roomName: null | string;
    /**
     * True for meal events and anything from the הפסקות syllabus. No generated
     * break may sit directly against one of these.
     */
    isExistingBreak: boolean;
    /** Pinned to a clock time (meals) — never shifted to make room for a break. */
    isPinned: boolean;
};

/** A prayer window in minutes-of-day. */
export type PrayerWindow = {
    name: string;
    startMinutes: number;
    endMinutes: number;
};

export type BreakPassInput = {
    items: Array<PlacedItem>;
    /** End of the day's working window, minutes-of-day. */
    dayEndMinutes: number;
    prayers: Array<PrayerWindow>;
};

/** A break the pass decided to create. */
export type GeneratedBreak = {
    kind: BreakKind;
    title: string;
    startMinutes: number;
    endMinutes: number;
    /** Prayer this break was positioned to cover, when any. */
    coversPrayer: null | string;
    /** Key of the item this break follows. */
    afterItemKey: string;
};

export type BreakPassResult = {
    /** Items with their post-pass times — unpinned ones may have shifted later. */
    items: Array<PlacedItem>;
    breaks: Array<GeneratedBreak>;
};

/** Minutes of free time between the last item and the day's end. */
function trailingSlack(
    items: Array<PlacedItem>,
    dayEndMinutes: number,
): number {
    const lastEnd = items.reduce(
        (max, item) => Math.max(max, item.endMinutes),
        0,
    );
    return Math.max(0, dayEndMinutes - lastEnd);
}

/**
 * The kind of break, if any, that the boundary between `before` and `after`
 * earns. Returns the highest-priority kind that applies — one boundary never
 * grows two stacked breaks.
 *
 * `exerciseRunMinutes` is the length of the continuous same-type run ending at
 * `before`, which is what the 90-minute ע"ע rule measures. `classRunMinutes`
 * is the length of the continuous run of *any* lecture/ע"ע mix ending at
 * `before` — arbitrary consecutive lecture/ע"ע events accumulate together,
 * which is what the 45-minute post-lecture rule measures.
 */
export function breakKindForBoundary(
    before: PlacedItem,
    after: PlacedItem,
    exerciseRunMinutes: number,
    classRunMinutes: number,
): BreakKind | null {
    // Never against an existing הפסקה — a generated break there just widens a
    // dead zone instead of spacing the day out.
    if (
        BREAK_PLACEMENT_RULES.forbidAdjacentToExistingBreak &&
        (before.isExistingBreak || after.isExistingBreak)
    ) {
        return null;
    }

    const candidates: Array<BreakKind> = [];

    if (
        LONG_EXERCISE_TYPES.includes(before.eventType) &&
        exerciseRunMinutes >= LONG_EXERCISE_THRESHOLD_MINUTES
    ) {
        candidates.push("post-long-exercise");
    }

    if (
        before.eventType === ModuleEventType.Lecture &&
        after.eventType === ModuleEventType.Lecture &&
        before.syllabusId !== after.syllabusId
    ) {
        candidates.push("between-syllabuses");
    }

    if (
        POST_LECTURE_RUN_TYPES.includes(before.eventType) &&
        classRunMinutes >= MIN_LECTURE_MINUTES_FOR_POST_BREAK
    ) {
        candidates.push("post-lecture");
    }

    if (roomKeyOf(before.roomName) !== roomKeyOf(after.roomName)) {
        candidates.push("room-change");
    }

    const enabled = candidates.filter((kind) => BREAK_RULES[kind].enabled);
    if (enabled.length === 0) return null;

    return enabled.sort(
        (a, b) => BREAK_RULES[a].priority - BREAK_RULES[b].priority,
    )[0];
}

/** The prayer a break starting at `startMinutes` for `length` would cover. */
function prayerCoveredBy(
    startMinutes: number,
    length: number,
    prayers: Array<PrayerWindow>,
): null | string {
    for (const prayer of prayers) {
        const overlap =
            Math.min(startMinutes + length, prayer.endMinutes) -
            Math.max(startMinutes, prayer.startMinutes);
        if (overlap >= PRAYER_RULES.coverageThresholdMinutes) return prayer.name;
    }
    return null;
}

/**
 * Insert breaks into a single day's slack.
 *
 * Guarantees:
 * - The day never grows: total inserted minutes never exceed the trailing
 *   slack, so the last item still ends at or before `dayEndMinutes`.
 * - Higher-priority break kinds are satisfied first; when slack runs out the
 *   remaining candidates are dropped rather than shortened below their
 *   `minimumMinutes`.
 * - Leftover slack is grown into the breaks that already exist (largest
 *   priority first, capped by `maximumMinutes`) instead of being left as one
 *   long empty tail — and never grown past `implicitBreakCeilingMinutes`.
 */
export function insertBreaksForDay(input: BreakPassInput): BreakPassResult {
    const items = [...input.items].sort((a, b) => a.startMinutes - b.startMinutes);
    if (items.length < 2) return { items, breaks: [] };

    let budget = trailingSlack(items, input.dayEndMinutes);
    if (budget < BREAK_PLACEMENT_RULES.minimumMaterializedMinutes) {
        return { items, breaks: [] };
    }

    // Candidate boundaries, each with the kind it earns.
    type Candidate = {
        afterIndex: number;
        kind: BreakKind;
        priority: number;
    };
    const candidates: Array<Candidate> = [];

    // Two separate run trackers: `exerciseRunMinutes` requires the exact same
    // type (only ע"ע counts) for the 90-minute rule; `classRunMinutes` accepts
    // any consecutive mix of lecture/ע"ע types for the 45-minute rule, so N
    // arbitrary back-to-back lecture/ע"ע events accumulate together.
    let exerciseRunMinutes = 0;
    let exerciseRunType: ModuleEventType | null = null;
    let classRunMinutes = 0;
    for (let index = 0; index < items.length - 1; index++) {
        const before = items[index];
        const after = items[index + 1];

        const duration = before.endMinutes - before.startMinutes;

        exerciseRunMinutes =
            before.eventType === exerciseRunType ? exerciseRunMinutes + duration : duration;
        exerciseRunType = before.eventType;

        classRunMinutes = POST_LECTURE_RUN_TYPES.includes(before.eventType)
            ? classRunMinutes + duration
            : 0;

        const kind = breakKindForBoundary(before, after, exerciseRunMinutes, classRunMinutes);
        if (!kind) continue;

        candidates.push({
            afterIndex: index,
            kind,
            priority: BREAK_RULES[kind].priority,
        });

        // A satisfied break resets the continuous-run measurement it fed.
        if (kind === "post-long-exercise") exerciseRunMinutes = 0;
        if (kind === "post-lecture" || kind === "between-syllabuses") classRunMinutes = 0;
    }

    // Prefer boundaries whose break would land on a prayer, then honour the
    // priority ladder. A boundary that covers a prayer is promoted, never
    // demoted, so prayer alignment costs nothing when it is achievable.
    const prayerAligned = new Set(
        candidates
            .filter((candidate) => {
                const boundary = items[candidate.afterIndex].endMinutes;
                return (
                    prayerCoveredBy(
                        boundary,
                        BREAK_RULES[candidate.kind].preferredMinutes,
                        input.prayers,
                    ) !== null
                );
            })
            .map((candidate) => candidate.afterIndex),
    );

    const ordered = [...candidates].sort((a, b) => {
        const aligned =
            Number(prayerAligned.has(b.afterIndex)) -
            Number(prayerAligned.has(a.afterIndex));
        if (aligned !== 0) return aligned;
        return a.priority - b.priority;
    });

    // Allocate the budget by priority; anything that cannot reach its minimum
    // is dropped outright.
    const allocated = new Map<number, { kind: BreakKind; minutes: number }>();
    for (const candidate of ordered) {
        const rule = BREAK_RULES[candidate.kind];
        const minutes = Math.min(rule.preferredMinutes, budget);
        if (minutes < rule.minimumMinutes) continue;
        allocated.set(candidate.afterIndex, { kind: candidate.kind, minutes });
        budget -= minutes;
    }

    // Redistribute what is left rather than leaving one long empty tail: grow
    // existing breaks, highest priority first, up to their own maximum and
    // never past the implicit-break ceiling.
    if (BREAK_PLACEMENT_RULES.redistributeTrailingSlack && budget > 0) {
        const growable = [...allocated.entries()].sort(
            (a, b) =>
                BREAK_RULES[a[1].kind].priority - BREAK_RULES[b[1].kind].priority,
        );
        for (const [index, entry] of growable) {
            if (budget <= 0) break;
            const ceiling = Math.min(
                BREAK_RULES[entry.kind].maximumMinutes,
                BREAK_PLACEMENT_RULES.implicitBreakCeilingMinutes,
            );
            const growth = Math.min(ceiling - entry.minutes, budget);
            if (growth <= 0) continue;
            allocated.set(index, { ...entry, minutes: entry.minutes + growth });
            budget -= growth;
        }
    }

    // Walk the day, shifting unpinned items later by the breaks inserted so far.
    const breaks: Array<GeneratedBreak> = [];
    const shifted: Array<PlacedItem> = [];
    let offset = 0;

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // A pinned meal keeps its clock time; the offset resets to whatever the
        // pin implies so the following events resume from the real position.
        if (item.isPinned) {
            shifted.push(item);
            offset = 0;
        } else {
            shifted.push({
                ...item,
                startMinutes: item.startMinutes + offset,
                endMinutes: item.endMinutes + offset,
            });
        }

        const entry = allocated.get(index);
        if (!entry) continue;

        const startMinutes = shifted[shifted.length - 1].endMinutes;
        breaks.push({
            kind: entry.kind,
            title: BREAK_RULES[entry.kind].title,
            startMinutes,
            endMinutes: startMinutes + entry.minutes,
            coversPrayer: prayerCoveredBy(
                startMinutes,
                entry.minutes,
                input.prayers,
            ),
            afterItemKey: item.key,
        });
        offset += entry.minutes;
    }

    return { items: shifted, breaks };
}
