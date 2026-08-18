import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { ModuleEventType } from "@/api-shared/types/gantt/models/event";

/**
 * The single tunable source of truth for how the cut ("גזירה ללו"ז") balances a
 * week and spaces out its breaks.
 *
 * Everything the balancer and the break pass decide is expressed here as a
 * named constant or a small pure predicate. Changing scheduling policy should
 * mean editing this file — never the planner. The prose companion, including
 * the reasoning behind each priority, lives in `docs/gantt-cut-rules.md`;
 * keep the two in sync.
 *
 * Layering: this module is `api-shared` and stays pure — no I/O, no dayjs, no
 * React. It is imported by the pure planner, by the server that runs it, and
 * by the preview UI that explains its output.
 */

// ---------------------------------------------------------------------------
// 1. Day capacity
// ---------------------------------------------------------------------------

/**
 * A day's capacity is its **working window**: the clock span from the day's
 * start time to its end time (`GanttDay.dayEndTime`). Not a minute budget — a
 * wall-clock range, so a pinned meal at 13:00 anchors real time rather than
 * merely consuming a quota.
 *
 * Everything placed inside the window counts against it: lessons, pinned meal
 * events, and generated הפסקה breaks alike.
 */
export const CAPACITY_RULES = {
    /**
     * Fallback end time for a day with no explicit `dayEndTime` — used only
     * when a row predates the column and the migration backfill has not run.
     * Days at capacity 0 (typically שבת) are never spill targets regardless.
     */
    fallbackDayEndTime: "21:00",

    /**
     * Slack under this many minutes is treated as zero. Prevents the balancer
     * from shuffling an event across days to reclaim a trivial remainder.
     */
    negligibleSlackMinutes: 5,
} as const;

// ---------------------------------------------------------------------------
// 2. Spillover
// ---------------------------------------------------------------------------

/**
 * Spillover moves events off an over-full day onto a later day that has room.
 *
 * Invariants — these are the rules the balancer may never break:
 *
 * 1. **Never across weeks.** A spill target must live in the same
 *    `GanttWeek` as the source day. A week that cannot absorb its own load
 *    overlaps instead (see {@link OVERFLOW_RULES}).
 * 2. **Never forward-only into a full day.** An event is only moved onto a
 *    day that can actually hold it inside its working window. Overlapping on
 *    day X beats spilling onto an already-full day X+1.
 * 3. **Never outside working hours.** Nothing is ever placed past a day's end
 *    time by the balancer. Overlap is always the lesser wrong.
 * 4. **Forward only.** Events flow to later days in the week, never earlier —
 *    the mapped day is the earliest a user asked for it.
 *
 * Spill may cascade over several days in the same week, so a week with
 * everything piled onto ראשון rebalances across ראשון–חמישי.
 */
export const SPILLOVER_RULES = {
    /**
     * Candidate selection inside an over-full day. Best-fit: pick whichever
     * movable event packs the later days most tightly (largest event that
     * still fits the largest gap), rather than blindly spilling the tail.
     */
    strategy: "best-fit" as const,

    /**
     * Bonus weight, in minutes, added to a candidate's fitness when moving it
     * keeps its whole module together on one day. Module cohesion is a strong
     * preference but yields to a strictly better packing.
     */
    moduleCohesionBonusMinutes: 120,

    /**
     * Penalty weight, in minutes, for splitting a module across days. Applied
     * when a move would leave siblings from the same module behind.
     */
    moduleSplitPenaltyMinutes: 90,
} as const;

/**
 * Whether an occurrence may be moved off the day it was mapped to.
 *
 * Pinned in place:
 * - **Meal events** — their whole purpose is a fixed clock time.
 * - **Everything belonging to a daily recurrence**, echo *and* anchor alike.
 *   "Every day" stops being true the moment one occurrence hops, and moving
 *   the anchor is worse than moving an echo: the echo days were derived from
 *   the anchor's mapping before balancing ran, so relocating it leaves the
 *   mapped day empty and doubles up on the day it landed on.
 *
 * Free to move: ordinary mapped events and **weekly** recurrences — anchor and
 * echoes alike, each on its own merits, since a weekly event's day is a
 * preference rather than a promise.
 */
export type SpillCandidate = {
    /** True for the auto-seeded meal events pinned to a clock time. */
    isPinnedMeal: boolean;
    /** True when this occurrence is a recurrence echo rather than the mapped day. */
    isRecurrenceEcho: boolean;
    /** True when the source event recurs daily. */
    isDailyRecurrence: boolean;
};

export function isSpillable(candidate: SpillCandidate): boolean {
    if (candidate.isPinnedMeal) return false;
    if (candidate.isDailyRecurrence) return false;
    return true;
}

/**
 * What happens when a week is over capacity even after the balancer has packed
 * every day in it — the load simply does not fit into the week's working hours.
 *
 * The cut never silently invents time. It surfaces the week as a decision
 * (`week-overflow`) and lets the user choose; {@link defaultResolution} is
 * what the dialog pre-selects and what a non-interactive caller gets.
 */
export const OVERFLOW_RULES = {
    /**
     * `overlap-source` — leftovers stay on the day they were mapped to and
     * overlap the events already there. Honours "always prefer overlapping
     * events rather than placing events outside working hours".
     */
    defaultResolution: "overlap-source" as const,

    /** Every resolution the dialog may offer for an overflowing week. */
    resolutions: [
        "overlap-source",
        "overlap-least-full",
        "extend-day",
        "drop",
    ] as const,
} as const;

export type WeekOverflowResolution =
    (typeof OVERFLOW_RULES.resolutions)[number];

// ---------------------------------------------------------------------------
// 3. Breaks (post-pass)
// ---------------------------------------------------------------------------

/**
 * Kinds of break the post-pass can insert, in **descending priority**. When a
 * day has less slack than the breaks it wants, higher-priority kinds are
 * satisfied first and the rest are dropped — breaks never extend a day past
 * its end time.
 *
 * Ordering rationale (see `docs/gantt-cut-rules.md` for the long form):
 * fatigue from a long unbroken ע"ע block is the most concrete harm; a context
 * switch between syllabuses is the next; covering a prayer is a scheduling win
 * that costs nothing when it can be arranged; a plain post-lecture breather is
 * the nicety that yields first.
 */
export const BREAK_KINDS = [
    "post-long-exercise",
    "between-syllabuses",
    "prayer-cover",
    "post-lecture",
    "room-change",
] as const;

export type BreakKind = (typeof BREAK_KINDS)[number];

export type BreakRule = {
    /** Lower number = inserted first when slack is scarce. */
    priority: number;
    /** Ideal length in minutes. */
    preferredMinutes: number;
    /** Shortest acceptable length; below this the break is dropped entirely. */
    minimumMinutes: number;
    /** Longest this break may be stretched to absorb leftover slack. */
    maximumMinutes: number;
    /** Hebrew title given to the generated הפסקה event. */
    title: string;
    /** Off-switch for a rule that is specified but not yet actionable. */
    enabled: boolean;
    /** Why the rule exists — shown in docs and the preview's explanation. */
    rationale: string;
};

export const BREAK_RULES: Record<BreakKind, BreakRule> = {
    /** 15 minutes after 90+ minutes of continuous ע"ע. */
    "post-long-exercise": {
        priority: 1,
        preferredMinutes: 15,
        minimumMinutes: 10,
        maximumMinutes: 20,
        title: "הפסקה",
        enabled: true,
        rationale:
            'רצף ע"ע ארוך הוא העומס הקוגניטיבי הכבד ביותר ביום, ולכן ההפסקה שאחריו מקבלת עדיפות ראשונה.',
    },
    /** 10–15 minutes between consecutive lectures from different syllabuses. */
    "between-syllabuses": {
        priority: 2,
        preferredMinutes: 15,
        minimumMinutes: 10,
        maximumMinutes: 20,
        title: "הפסקה",
        enabled: true,
        rationale:
            "מעבר בין סילבוסים דורש החלפת הקשר; בלי הפסקה ההרצאה השנייה מתחילה על שאריות הראשונה.",
    },
    /** A break deliberately positioned to cover a prayer window. */
    "prayer-cover": {
        priority: 3,
        preferredMinutes: 15,
        minimumMinutes: 10,
        maximumMinutes: 20,
        title: "הפסקה",
        enabled: true,
        rationale:
            "הפסקה שממילא נדרשת ומכסה זמן תפילה חוסכת חלון נפרד ביום.",
    },
    /** 10 minutes after any lecture. */
    "post-lecture": {
        priority: 4,
        preferredMinutes: 10,
        minimumMinutes: 10,
        maximumMinutes: 15,
        title: "הפסקה",
        enabled: true,
        rationale: "נשימה קצרה אחרי הרצאה — רצוי, אך נופל ראשון כשאין זמן.",
    },
    /**
     * 5 minutes between events in different rooms.
     *
     * Disabled: the cut assigns no rooms today (`rooms: []` in
     * `api-server/gantt/cut.ts`), and a Gantt event only carries a coarse
     * `roomRequirement`. Flip `enabled` on once real room assignment lands and
     * `roomKeyOf` below starts returning meaningful keys.
     */
    "room-change": {
        priority: 5,
        preferredMinutes: 5,
        minimumMinutes: 5,
        maximumMinutes: 5,
        title: "מעבר כיתה",
        enabled: false,
        rationale:
            "מעבר פיזי בין כיתות גוזל זמן שאינו מופיע בלו״ז. ממתין לשיוך כיתות אמיתי בגזירה.",
    },
};

/** Rooms that never justify a transition break — no walk is involved. */
export const ROOMLESS_ROOM_NAMES: ReadonlyArray<string> = [
    "ללא כיתה",
    "בחוץ",
];

/**
 * Room identity used by the `room-change` rule. Returns `null` for
 * "no meaningful room", which never triggers a transition break.
 * Returns `null` unconditionally while the rule is disabled.
 */
export function roomKeyOf(roomName: null | string | undefined): null | string {
    if (!roomName) return null;
    if (ROOMLESS_ROOM_NAMES.includes(roomName)) return null;
    return roomName;
}

/** Continuous ע"ע at or above this many minutes earns a break after it. */
export const LONG_EXERCISE_THRESHOLD_MINUTES = 90;

/** Event types that count toward a "continuous ע\"ע" run. */
export const LONG_EXERCISE_TYPES: ReadonlyArray<ModuleEventType> = [
    ModuleEventType.Exercise,
];

/**
 * Structural rules that constrain *where* a break may go, independent of kind.
 */
export const BREAK_PLACEMENT_RULES = {
    /**
     * A generated break is never placed directly adjacent to an existing
     * הפסקה — a meal event or anything from the auto-seeded הפסקות syllabus.
     * Two touching breaks read as one long dead zone.
     */
    forbidAdjacentToExistingBreak: true,

    /**
     * Gap (minutes) under which a generated break counts as "directly
     * adjacent" to an existing break.
     */
    adjacencyToleranceMinutes: 5,

    /**
     * Instead of a forbidden adjacent break, the pass grows an *earlier* break
     * in the same day, up to this many minutes. Keeps the recovered time in
     * the day without creating a second dead zone next to the meal.
     */
    earlierBreakGrowthCapMinutes: 20,

    /**
     * Any single stretch of free time at or above this is an implicit break
     * the user never asked for. The pass redistributes rather than leaving it:
     * two well-placed breaks of 10 and 15 beat one of 25.
     */
    implicitBreakCeilingMinutes: 25,

    /** Breaks shorter than this are not worth materializing as an event. */
    minimumMaterializedMinutes: 5,

    /**
     * Leftover slack is pushed into existing breaks (largest priority first)
     * before being left as trailing empty time at the end of the day.
     */
    redistributeTrailingSlack: true,
} as const;

// ---------------------------------------------------------------------------
// 4. Prayers
// ---------------------------------------------------------------------------

/**
 * Prayers (שחרית / מנחה / ערבית) come from the schedule settings in MongoDB and
 * are handed to the pure planner by `api-server/gantt/cut.ts`.
 *
 * They are **soft** windows, unlike meals:
 * - The break pass prefers to position a break so it covers a prayer.
 * - A lecture that lands on a prayer is re-ordered within its day when that is
 *   possible without pushing the day past its end time — otherwise it simply
 *   overlaps. A prayer never forces spillover and never extends a day.
 */
export const PRAYER_RULES = {
    /** Assumed length of a prayer window when settings carry only a start time. */
    defaultDurationMinutes: 20,

    /** Event types that should not sit on top of a prayer, best-effort. */
    avoidOverlapForTypes: [ModuleEventType.Lecture] as ReadonlyArray<ModuleEventType>,

    /**
     * A break counts as "covering" a prayer when it overlaps the prayer window
     * by at least this many minutes.
     */
    coverageThresholdMinutes: 10,

    /** Prayers are never allowed to push the day past its end time. */
    mayExtendDay: false,
} as const;

// ---------------------------------------------------------------------------
// 5. Constraints
// ---------------------------------------------------------------------------

/**
 * How the cut treats `GanttConstraint`s (relational after/before with optional
 * min/max day delays, and temporal allowed/forbidden weekdays).
 *
 * The cut runs a full solver pass, but never applies a cross-day move silently:
 * moves the user did not ask for surface as a `constraint-moves` decision the
 * dialog asks them to accept or reject. Unsatisfiable constraints surface as a
 * `constraint-violation` decision rather than blocking the cut.
 */
export const CONSTRAINT_RULES = {
    /** Reorder events inside a day so an "after" target precedes its dependent. */
    reorderWithinDay: true,

    /** Move events across days (same week) to satisfy constraints. */
    solveAcrossDays: true,

    /** Ask before committing solver-initiated cross-day moves. */
    promptBeforeApplyingMoves: true,

    /**
     * Iteration cap for the solver. Constraint graphs here are small; the cap
     * exists so a cyclic graph terminates instead of spinning.
     */
    maxSolverPasses: 8,

    /**
     * Capacity outranks constraints: a solver move is rejected outright when
     * it would place an event outside a day's working window.
     */
    capacityOutranksConstraints: true,
} as const;

/**
 * Days that never receive spilled or solver-moved events regardless of their
 * configured capacity.
 */
export const NEVER_SCHEDULE_DAY_INDICES: ReadonlyArray<GanttDayIndex> = [
    GanttDayIndex.Saturday,
];

// ---------------------------------------------------------------------------
// 6. Global priority ladder
// ---------------------------------------------------------------------------

/**
 * When two rules disagree, the earlier entry wins. This is the tie-breaker of
 * record for the whole cut — the balancer, the break pass and the constraint
 * solver all resolve conflicts by consulting this order.
 */
export const CUT_PRIORITY_LADDER: ReadonlyArray<{
    rule: string;
    description: string;
}> = [
    {
        rule: "within-working-hours",
        description:
            "אף אירוע לא יוצב מחוץ לשעות העבודה של היום. חפיפה עדיפה תמיד על חריגה.",
    },
    {
        rule: "same-week-only",
        description: "גלישה מתרחשת רק בין ימים באותו שבוע, לעולם לא בין שבועות.",
    },
    {
        rule: "never-spill-into-full-day",
        description:
            "עדיף להשאיר חפיפה ביום X מאשר לגלוש ליום X+1 שכבר מלא.",
    },
    {
        rule: "pinned-events-stay",
        description: 'ארוחות ומחזוריות יומית נשארות במקומן; מחזוריות שבועית חופשית לזוז.',
    },
    {
        rule: "satisfy-constraints",
        description:
            "אילוצים בין אירועים ומערכים ייושבו כשניתן, ובכפוף לכל הכללים שמעליהם.",
    },
    {
        rule: "module-cohesion",
        description: "אירועים מאותו מערך יישארו יחד באותו יום כשאפשר.",
    },
    {
        rule: "breaks-by-priority",
        description:
            "הפסקות נוספות לפי סדר העדיפות ב-BREAK_RULES, ורק לתוך זמן פנוי קיים.",
    },
    {
        rule: "prayer-alignment",
        description:
            "הפסקות ינסו לכסות זמני תפילה, והרצאות ינסו להימנע מהם — שתיהן ברמת מאמץ בלבד.",
    },
];
