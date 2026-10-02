/** One of an event's mappings, as the grid edits it. */
export type AllotmentMapping = { dayId: string; allottedMinutes: number };

export type AllotmentInput = {
    /** The week's new value, in minutes. */
    minutes: number;
    /** Days of the edited week, in order. */
    weekDays: Array<string>;
    /** The event's own mappings, in timeline order (earliest first). */
    mappings: Array<AllotmentMapping>;
    /** Days of the week holding a day, in order. */
    weekDaysOf: (dayId: string) => Array<string>;
    /** A recurrence echo of the event inside the edited week, if any. */
    echoDayId?: string;
    splitAcrossWeeks: boolean;
};

/**
 * What a week-cell edit does to the event's mappings:
 * - `set`: change minutes on mappings already in the week.
 * - `zero`: the week was set to 0 — ask whether to keep 0-minute mappings or remove them.
 * - `create`: add a mapping on a day of the week.
 * - `outside`: the event sits in another week and may not split — ask whether
 *   to move its mapping here or turn on splitting across weeks.
 * - `materialize`: the week only holds a recurrence echo — turn that occurrence
 *   into its own event, then allot the minutes to it.
 */
export type AllotmentPlan =
    | { kind: "create"; dayId: string; minutes: number }
    | { kind: "materialize"; dayId: string; minutes: number }
    | { kind: "none" }
    | { kind: "outside"; dayId: string; fromDayId: string; minutes: number }
    | { kind: "set"; changes: Array<{ dayId: string; minutes: number }> }
    | { kind: "zero"; dayIds: Array<string> };

/** Parses a typed hours value: decimal ("1.5"), clock ("1:30") or blank (0). Null when invalid. */
export function parseHoursInput(text: string): null | number
{
    const value = text.trim();
    if (value === "") return 0;
    const clock = /^(\d+):([0-5]\d)$/.exec(value);
    if (clock) return Number(clock[ 1 ]) * 60 + Number(clock[ 2 ]);
    if (!/^\d*\.?\d+$/.test(value)) return null;
    return Math.round(Number(value) * 60);
}

/**
 * Plans a week-cell edit. Mappings already in the week take the new value
 * (several: the last one absorbs the difference). An empty week gets a
 * mapping on the same weekday as the event's first mapping.
 */
export function planWeekAllotment(input: AllotmentInput): AllotmentPlan
{
    const { minutes, weekDays, mappings } = input;
    const inWeek = mappings.filter((m) => weekDays.includes(m.dayId));

    if (inWeek.length > 0)
    {
        if (minutes === 0) return { kind: "zero", dayIds: inWeek.map((m) => m.dayId) };
        const current = inWeek.reduce((sum, m) => sum + m.allottedMinutes, 0);
        if (current === minutes) return { kind: "none" };
        // The last mapping takes the difference; earlier ones give up time only once it hits 0.
        let delta = minutes - current;
        const changes: Array<{ dayId: string; minutes: number }> = [];
        for (const mapping of [ ...inWeek ].reverse())
        {
            if (delta === 0) break;
            const next = Math.max(0, mapping.allottedMinutes + delta);
            delta -= next - mapping.allottedMinutes;
            changes.push({ dayId: mapping.dayId, minutes: next });
        }
        return { kind: "set", changes };
    }

    if (minutes === 0 || weekDays.length === 0) return { kind: "none" };
    if (input.echoDayId) return { kind: "materialize", dayId: input.echoDayId, minutes };

    const [ first ] = mappings;
    if (!first) return { kind: "create", dayId: weekDays[ 0 ], minutes };
    const position = Math.max(0, input.weekDaysOf(first.dayId).indexOf(first.dayId));
    const dayId = weekDays[ Math.min(position, weekDays.length - 1) ];
    return input.splitAcrossWeeks
        ? { kind: "create", dayId, minutes }
        : { kind: "outside", dayId, fromDayId: first.dayId, minutes };
}

/** Remembered answer to the "keep 0 or remove" question, for a while. */
export type ZeroChoice = "keep" | "remove";

const ZERO_CHOICE_KEY = "bluz.grid.zeroAllotmentChoice";
const ZERO_CHOICE_TTL_MS = 30 * 60 * 1000;

export function readZeroChoice(now = Date.now()): null | ZeroChoice
{
    try
    {
        const saved = JSON.parse(window.localStorage.getItem(ZERO_CHOICE_KEY) ?? "null") as
            { choice: ZeroChoice; until: number } | null;
        return saved && saved.until > now ? saved.choice : null;
    } catch
    {
        return null;
    }
}

export function saveZeroChoice(choice: ZeroChoice, now = Date.now()): void
{
    try
    {
        window.localStorage.setItem(ZERO_CHOICE_KEY, JSON.stringify({ choice, until: now + ZERO_CHOICE_TTL_MS }));
    } catch
    {
        // Storage blocked: the question is simply asked again.
    }
}
