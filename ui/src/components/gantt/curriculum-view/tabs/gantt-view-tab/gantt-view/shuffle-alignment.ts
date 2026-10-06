/**
 * Name: shuffle-alignment.ts
 * Purpose: Warns, before a drop, when it would break the rule that a
 *   syllabus's shuffles share the same block every day: each shuffle's
 *   scheduled time on a day must match the others' (#886). Events limited to
 *   some courses are exempt, and syllabuses never constrain each other, so
 *   mutually exclusive courses stay independent.
 * Created: 2026-10-06
 * Author: Michael K. Steinberg
 */
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";

export type AlignmentSources = {
    syllabuses: Readonly<Record<string, { shuffles?: Array<string> } | undefined>>;
    modules: Readonly<Record<string, { syllabusId: string; shuffles?: Array<string>; events?: Array<string> } | undefined>>;
    events: Readonly<Record<string, {
        moduleId: string;
        shuffles?: Array<string>;
        courseIds?: Array<string>;
        minimumDuration?: number;
    } | undefined>>;
    /** Event id → the day it is placed on. */
    eventMappings: Readonly<Record<string, string>>;
};

export type EventMove = { eventId: string; to: string };

/** The shuffles an event runs for: its own, else its module's, else all. */
function shufflesOf(eventId: string, all: Array<string>, sources: AlignmentSources): Array<string>
{
    const event = sources.events[ eventId ];
    if (event?.shuffles?.length) return event.shuffles;
    const moduleShuffles = event ? sources.modules[ event.moduleId ]?.shuffles : undefined;
    return moduleShuffles?.length ? moduleShuffles : all;
}

/** The events `mappings` places on each of `days`, in one pass over the mappings. */
function eventsOnDays(mappings: Readonly<Record<string, string>>, days: ReadonlySet<string>): Map<string, Array<string>>
{
    const byDay = new Map<string, Array<string>>();
    for (const [ eventId, day ] of Object.entries(mappings))
    {
        if (!days.has(day)) continue;
        const events = byDay.get(day);
        if (events) events.push(eventId);
        else byDay.set(day, [ eventId ]);
    }
    return byDay;
}

/**
 * Minutes each shuffle of `syllabusId` has among `eventIds`.
 *
 * Approximation: a placed event counts its `minimumDuration`, the same
 * figure the timeline's day totals use and the full allotment a placement
 * gets by default. The rule itself is about the shared block having the same
 * start and end for every shuffle; equal daily time per shuffle is how that
 * shows at the gantt's day granularity, before the cut assigns clock times.
 * Course-limited events don't count: they need not align (#886).
 */
function shuffleMinutes(syllabusId: string, eventIds: Iterable<string>, sources: AlignmentSources): Map<string, number>
{
    const all = sources.syllabuses[ syllabusId ]?.shuffles ?? [];
    const totals = new Map(all.map((name) => [ name, 0 ]));
    for (const eventId of eventIds)
    {
        const event = sources.events[ eventId ];
        if (!event || event.courseIds?.length) continue;
        if (sources.modules[ event.moduleId ]?.syllabusId !== syllabusId) continue;
        for (const name of shufflesOf(eventId, all, sources))
        {
            if (totals.has(name)) totals.set(name, (totals.get(name) ?? 0) + (event.minimumDuration ?? 0));
        }
    }
    return totals;
}

/** Minutes each shuffle of `syllabusId` has on `dayId`, under `mappings`. */
export function shuffleMinutesOnDay(
    syllabusId: string,
    dayId: string,
    mappings: Readonly<Record<string, string>>,
    sources: AlignmentSources,
): Map<string, number>
{
    return shuffleMinutes(syllabusId, eventsOnDays(mappings, new Set([ dayId ])).get(dayId) ?? [], sources);
}

const isAligned = (totals: Map<string, number>) => new Set(totals.values()).size <= 1;

/**
 * Why `moves` would misalign a syllabus's shuffles on some day, or null.
 * Only a day that was aligned and no longer is counts; an existing
 * imbalance is not this drop's doing. Runs per hovered cell, so the
 * mappings are indexed by day once per call rather than once per check.
 * It reports the first broken day only: the cell warning is a hint.
 */
export function shuffleAlignmentWarning(moves: Array<EventMove>, sources: AlignmentSources): null | string
{
    if (moves.length === 0) return null;
    const after: Record<string, string> = { ...sources.eventMappings };
    const checks = new Map<string, Set<string>>();
    const allDays = new Set<string>();
    const check = (syllabusId: string, dayId: string | undefined) =>
    {
        if (!dayId) return;
        const days = checks.get(syllabusId) ?? new Set<string>();
        days.add(dayId);
        checks.set(syllabusId, days);
        allDays.add(dayId);
    };

    for (const { eventId, to } of moves)
    {
        const event = sources.events[ eventId ];
        const syllabusId = event ? sources.modules[ event.moduleId ]?.syllabusId : undefined;
        if (!syllabusId || (sources.syllabuses[ syllabusId ]?.shuffles?.length ?? 0) < 2) continue;
        check(syllabusId, sources.eventMappings[ eventId ]);
        check(syllabusId, to);
        after[ eventId ] = to;
    }
    if (checks.size === 0) return null;

    const beforeByDay = eventsOnDays(sources.eventMappings, allDays);
    const afterByDay = eventsOnDays(after, allDays);
    for (const [ syllabusId, days ] of checks)
    {
        for (const dayId of days)
        {
            const before = shuffleMinutes(syllabusId, beforeByDay.get(dayId) ?? [], sources);
            const next = shuffleMinutes(syllabusId, afterByDay.get(dayId) ?? [], sources);
            if (isAligned(before) && !isAligned(next))
            {
                const detail = [ ...next ].map(([ name, minutes ]) => `${name} ${formatHoursLabel(minutes)}`).join(", ");
                return `שאפלי הסילבוס לא יתחילו ויסתיימו יחד (${detail})`;
            }
        }
    }
    return null;
}
