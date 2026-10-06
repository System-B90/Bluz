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

/**
 * Minutes each shuffle of `syllabusId` has on `dayId`, under `mappings`.
 * Course-limited events don't count: they need not align (#886).
 */
export function shuffleMinutesOnDay(
    syllabusId: string,
    dayId: string,
    mappings: Readonly<Record<string, string>>,
    sources: AlignmentSources,
): Map<string, number>
{
    const all = sources.syllabuses[ syllabusId ]?.shuffles ?? [];
    const totals = new Map(all.map((name) => [ name, 0 ]));
    for (const [ eventId, day ] of Object.entries(mappings))
    {
        if (day !== dayId) continue;
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

const isAligned = (totals: Map<string, number>) => new Set(totals.values()).size <= 1;

/**
 * Why `moves` would misalign a syllabus's shuffles on some day, or null.
 * Only a day that was aligned and no longer is counts; an existing
 * imbalance is not this drop's doing.
 */
export function shuffleAlignmentWarning(moves: Array<EventMove>, sources: AlignmentSources): null | string
{
    if (moves.length === 0) return null;
    const after: Record<string, string> = { ...sources.eventMappings };
    const checks = new Map<string, Set<string>>();
    const check = (syllabusId: string, dayId: string | undefined) =>
    {
        if (!dayId) return;
        const days = checks.get(syllabusId) ?? new Set<string>();
        days.add(dayId);
        checks.set(syllabusId, days);
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

    for (const [ syllabusId, days ] of checks)
    {
        for (const dayId of days)
        {
            const before = shuffleMinutesOnDay(syllabusId, dayId, sources.eventMappings, sources);
            const next = shuffleMinutesOnDay(syllabusId, dayId, after, sources);
            if (isAligned(before) && !isAligned(next))
            {
                const detail = [ ...next ].map(([ name, minutes ]) => `${name} ${formatHoursLabel(minutes)}`).join(", ");
                return `שאפלי הסילבוס לא יתחילו ויסתיימו יחד (${detail})`;
            }
        }
    }
    return null;
}
