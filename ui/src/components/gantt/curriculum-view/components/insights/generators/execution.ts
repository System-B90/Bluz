import dayjs from "dayjs";

import { sameInstructorSets } from "@/api-shared/gantt/execution";
import {
    GanttEventExecution,
    OccurrenceExecution,
} from "@/api-shared/types/gantt/execution";
import {
    hours,
    percent,
    pluralize,
    sumBy,
} from "@/components/gantt/curriculum-view/components/insights/format";
import {
    InsightContext,
    InsightGenerator,
} from "@/components/gantt/curriculum-view/components/insights/types";

type TaggedOccurrence = OccurrenceExecution & { ganttEventId: string };

function executions(ctx: InsightContext): Array<GanttEventExecution> {
    return Object.values(ctx.execution);
}

function occurrences(ctx: InsightContext): Array<TaggedOccurrence> {
    return executions(ctx).flatMap((e) => e.occurrences.map((o) => ({ ...o, ganttEventId: e.ganttEventId })));
}

function titleOf(ctx: InsightContext, ganttEventId: string): string {
    return ctx.state.events[ ganttEventId ]?.title ?? "מופע שנמחק מהגאנט";
}

/** Minutes the actual start moved from the planned one; null when either side is missing. */
function startShiftMinutes(occ: OccurrenceExecution): null | number {
    if (!occ.planned || !occ.actual) return null;
    return dayjs(occ.actual.startTime).diff(dayjs(occ.planned.startTime), "minute");
}

const driftRate: InsightGenerator = (ctx) => {
    const all = executions(ctx);
    if (all.length === 0) return null;
    const drifted = all.filter((e) => e.drifted).length;
    const intact = all.length - drifted;
    return {
        id: "execution-drift-rate",
        category: "execution",
        severity: drifted === 0 ? "success" : percent(drifted, all.length) > 30 ? "warning" : "info",
        title: drifted === 0
            ? "הלו\"ז תואם את הגאנט במלואו"
            : `${percent(intact, all.length)}% מהמופעים שנגזרו עדיין תואמים לתכנון`,
        body: drifted === 0
            ? `כל ${all.length} המופעים שנגזרו מתקיימים בדיוק כמתוכנן.`
            : `${pluralize(drifted, "מופע אחד", "מופעים")} סטו מהתכנון (זמן, משך, מדריכים או מחיקה).`,
        visual: { kind: "ring", value: intact, max: all.length, label: `${intact}/${all.length}` },
    };
};

const deletedOccurrences: InsightGenerator = (ctx) => {
    const deleted = occurrences(ctx).filter((o) => o.planned && !o.actual);
    if (deleted.length === 0) return null;
    return {
        id: "execution-deleted",
        category: "execution",
        severity: "warning",
        title: `${pluralize(deleted.length, "מופע מתוכנן אחד", "מופעים מתוכננים")} נמחקו מהלו"ז`,
        body: "הם קיימים בגאנט אבל לא בלו\"ז. אפשר ליצור אותם מחדש מחלון המופע.",
        visual: {
            kind: "chips",
            chips: deleted.slice(0, 6).map((o) => ({ label: `${titleOf(ctx, o.ganttEventId)} (${dayjs(o.occurrenceDate).format("D.M")})` })),
        },
    };
};

const orphanedOccurrences: InsightGenerator = (ctx) => {
    const orphaned = occurrences(ctx).filter((o) => !o.planned && o.actual);
    if (orphaned.length === 0) return null;
    return {
        id: "execution-orphaned",
        category: "execution",
        severity: "warning",
        title: `${pluralize(orphaned.length, "אירוע אחד", "אירועים")} בלו"ז כבר לא מופיעים בתכנון`,
        body: "הגאנט השתנה אחרי הגזירה. שווה לשקול טעינה מחדש של הלו\"ז.",
        visual: { kind: "chips", chips: orphaned.slice(0, 6).map((o) => ({ label: o.actual?.name ?? "" })) },
    };
};

const minutesDelta: InsightGenerator = (ctx) => {
    const all = executions(ctx);
    if (all.length === 0) return null;
    const planned = all.reduce((s, e) => s + e.totals.plannedMinutes, 0);
    const actual = all.reduce((s, e) => s + e.totals.actualMinutes, 0);
    const delta = actual - planned;
    if (Math.abs(delta) < 30) return null;
    return {
        id: "execution-minutes-delta",
        category: "execution",
        severity: Math.abs(delta) > planned * 0.1 ? "warning" : "info",
        title: delta > 0 ? `בפועל יש ${hours(delta)} יותר מהתכנון` : `בפועל חסרות ${hours(-delta)} מהתכנון`,
        body: `תוכננו ${hours(planned)}, ובלו"ז יש ${hours(actual)}.`,
        visual: {
            kind: "bars",
            bars: [
                { label: "תכנון", value: planned, max: Math.max(planned, actual) },
                { label: "ביצוע", value: actual, max: Math.max(planned, actual), highlight: true },
            ],
        },
    };
};

const mostShifted: InsightGenerator = (ctx) => {
    const shifted = occurrences(ctx)
        .map((o) => ({ o, shift: startShiftMinutes(o) }))
        .filter((x): x is { o: TaggedOccurrence; shift: number } => x.shift !== null && x.shift !== 0);
    if (shifted.length === 0) return null;
    const byEvent = sumBy(shifted, (x) => x.o.ganttEventId, (x) => Math.abs(x.shift));
    const days = (minutes: number) => (Math.abs(minutes) >= 24 * 60 ? `${Math.round(minutes / (24 * 60))} ימים` : hours(Math.abs(minutes)));
    return {
        id: "execution-most-shifted",
        category: "execution",
        severity: "info",
        title: `${pluralize(shifted.length, "מופע אחד", "מופעים")} זזו בזמן`,
        body: `הכי הרבה זז "${titleOf(ctx, byEvent[0][0])}" — ${days(byEvent[0][1])} בסך הכל.`,
        visual: {
            kind: "leaderboard",
            rows: byEvent.slice(0, 4).map(([ id, value ]) => ({ label: titleOf(ctx, id), value, valueLabel: days(value) })),
        },
    };
};

const instructorSwaps: InsightGenerator = (ctx) => {
    const swaps = occurrences(ctx).filter((o) =>
        o.planned && o.actual && !sameInstructorSets(o.actual.instructorIds, o.planned.instructorIds));
    if (swaps.length === 0) return null;
    const newcomers = sumBy(
        swaps.flatMap((o) => (o.actual?.instructorIds ?? []).filter((id) => !o.planned?.instructorIds.includes(id))),
        (id) => `${id}`,
        () => 1,
    );
    return {
        id: "execution-instructor-swaps",
        category: "execution",
        severity: "info",
        title: `ב-${swaps.length} מופעים המדריכים שונים מהתכנון`,
        body: newcomers.length > 0
            ? `${ctx.instructorName(Number(newcomers[0][0]))} נכנס/ה הכי הרבה פעמים במקום המתוכנן.`
            : "מדריכים הוסרו בלי שאחרים נכנסו במקומם.",
        visual: newcomers.length > 0
            ? {
                kind: "leaderboard",
                rows: newcomers.slice(0, 4).map(([ id, value ]) => ({ label: ctx.instructorName(Number(id)), value, valueLabel: `+${value}` })),
            }
            : undefined,
    };
};

const renamed: InsightGenerator = (ctx) => {
    const renamedOccs = occurrences(ctx).filter((o) => {
        const title = ctx.state.events[ o.ganttEventId ]?.title;
        return o.actual && title && o.actual.name.trim() !== title.trim();
    });
    if (renamedOccs.length === 0) return null;
    return {
        id: "execution-renamed",
        category: "execution",
        severity: "info",
        title: `${pluralize(renamedOccs.length, "אירוע אחד", "אירועים")} בלו"ז קיבלו שם אחר`,
        body: `למשל "${titleOf(ctx, renamedOccs[0].ganttEventId)}" נקרא בלו"ז "${renamedOccs[0].actual?.name}".`,
    };
};

const syllabusDrift: InsightGenerator = (ctx) => {
    const cut = ctx.workEvents.filter((e) => ctx.execution[ e.id ]);
    const rows = sumBy(cut, (e) => e.syllabusTitle, (e) => (ctx.execution[ e.id ].drifted ? 1 : 0))
        .filter(([ , drifted ]) => drifted > 0);
    if (rows.length < 2) return null;
    return {
        id: "execution-syllabus-drift",
        category: "execution",
        severity: "info",
        title: `"${rows[0][0]}" הוא הסילבוס שהכי סטה מהתכנון`,
        body: "מספר המופעים שסטו בכל סילבוס.",
        visual: { kind: "leaderboard", rows: rows.slice(0, 5).map(([ label, value ]) => ({ label, value, valueLabel: `${value}` })) },
    };
};

const notCutYet: InsightGenerator = (ctx) => {
    if (executions(ctx).length === 0) return null;
    const missing = ctx.workEvents.filter((e) => e.isPlaced && !ctx.execution[ e.id ]);
    if (missing.length === 0) return null;
    return {
        id: "execution-not-cut",
        category: "execution",
        severity: "warning",
        title: `${pluralize(missing.length, "מופע משובץ אחד", "מופעים משובצים")} לא הגיעו ללו"ז`,
        body: "כנראה נוספו לגאנט אחרי הגזירה האחרונה.",
        visual: { kind: "chips", chips: missing.slice(0, 6).map((e) => ({ label: e.event.title })) },
    };
};

export const EXECUTION_INSIGHTS: Array<InsightGenerator> = [
    driftRate,
    deletedOccurrences,
    orphanedOccurrences,
    minutesDelta,
    mostShifted,
    instructorSwaps,
    renamed,
    syllabusDrift,
    notCutYet,
];
