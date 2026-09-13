import { getHolidayComment } from "@/api-shared/gantt/holidays";
import { getDayNameDisplay, HEBREW_DAYS_SHORT } from "@/api-shared/types/gantt/models";
import {
    dayLabel,
    hours,
    percent,
    pluralize,
} from "@/components/gantt/curriculum-view/components/insights/format";
import {
    InsightContext,
    InsightGenerator,
    InsightVisual,
    InsightWeek,
} from "@/components/gantt/curriculum-view/components/insights/types";
import { formatShortDate } from "@/components/gantt/curriculum-view/gantt-time-utils";

function loadRatio(week: InsightWeek): number {
    return week.capacityMinutes > 0 ? week.scheduledMinutes / week.capacityMinutes : 0;
}

function weekBars(ctx: InsightContext, highlightId?: string): InsightVisual {
    return {
        kind: "bars",
        bars: ctx.weeks.map((week) => ({
            label: `${week.number}`,
            value: week.scheduledMinutes,
            max: week.capacityMinutes,
            highlight: week.id === highlightId,
        })),
    };
}

function workingWeeks(ctx: InsightContext): Array<InsightWeek> {
    return ctx.weeks.filter((week) => week.capacityMinutes > 0);
}

const freestWeek: InsightGenerator = (ctx) => {
    const weeks = workingWeeks(ctx);
    if (weeks.length < 2 || ctx.scheduledMinutes === 0) return null;
    const week = weeks.reduce((best, w) => (loadRatio(w) < loadRatio(best) ? w : best));
    return {
        id: "freest-week",
        category: "schedule",
        severity: "info",
        title: `שבוע ${week.number} פנוי יחסית`,
        body: `רק ${percent(week.scheduledMinutes, week.capacityMinutes)}% מ-${hours(week.capacityMinutes)} העבודה בו שובצו. מקום טוב למערכים שעוד מחכים.`,
        visual: weekBars(ctx, week.id),
    };
};

const busiestWeek: InsightGenerator = (ctx) => {
    const weeks = workingWeeks(ctx);
    if (weeks.length < 2 || ctx.scheduledMinutes === 0) return null;
    const week = weeks.reduce((best, w) => (loadRatio(w) > loadRatio(best) ? w : best));
    const load = percent(week.scheduledMinutes, week.capacityMinutes);
    return {
        id: "busiest-week",
        category: "schedule",
        severity: load > 100 ? "warning" : "info",
        title: `שבוע ${week.number} הוא העמוס ביותר`,
        body: load > 100
            ? `שובצו בו ${load}% מהשעות הזמינות. אין דרך לסדר את זה בתוך השבוע בלבד.`
            : `${load}% מהשעות בו כבר תפוסות.`,
        visual: weekBars(ctx, week.id),
    };
};

const overloadedDays: InsightGenerator = (ctx) => {
    if (ctx.scheduledMinutes === 0) return null;
    const days = ctx.days.filter((d) => d.scheduledMinutes > d.capacityMinutes);
    if (days.length === 0) {
        return {
            id: "overloaded-days",
            category: "schedule",
            severity: "success",
            title: "אף יום לא חורג מהשעות שלו",
            body: "כל מופע שובץ נכנס ביום שלו או נשפך לימים פנויים. יפה.",
        };
    }
    return {
        id: "overloaded-days",
        category: "schedule",
        severity: "warning",
        title: `${pluralize(days.length, "יום אחד", "ימים")} חורגים מהשעות שלהם`,
        body: "בימים האלה שובץ יותר זמן ממה שיש. הגזירה תדחוף את העודף הלאה.",
        visual: {
            kind: "chips",
            chips: days.slice(0, 6).map((d) => ({
                label: `${dayLabel(d.weekNumber, d.dayIndex)} · +${hours(d.scheduledMinutes - d.capacityMinutes)}`,
            })),
        },
    };
};

const emptyWorkingDays: InsightGenerator = (ctx) => {
    if (ctx.scheduledMinutes === 0) return null;
    const empty = ctx.days.filter((d) => d.capacityMinutes > 0 && d.scheduledMinutes === 0);
    if (empty.length === 0) return null;
    return {
        id: "empty-days",
        category: "schedule",
        severity: "info",
        title: `${pluralize(empty.length, "יום עבודה אחד", "ימי עבודה")} ריקים לגמרי`,
        body: `ביחד ${hours(empty.reduce((s, d) => s + d.capacityMinutes, 0))} שעדיין לא נוצלו. הראשון: ${dayLabel(empty[0].weekNumber, empty[0].dayIndex)}.`,
        visual: {
            kind: "bigNumber",
            value: `${empty.length}`,
            caption: `מתוך ${ctx.days.filter((d) => d.capacityMinutes > 0).length} ימי עבודה`,
        },
    };
};

const coverage: InsightGenerator = (ctx) => {
    if (ctx.capacityMinutes === 0) return null;
    const pct = percent(ctx.scheduledMinutes, ctx.capacityMinutes);
    return {
        id: "coverage",
        category: "schedule",
        severity: pct > 100 ? "warning" : "info",
        title: `${pct}% משעות הקורס כבר משובצות`,
        body: `${hours(ctx.scheduledMinutes)} שובצו מתוך ${hours(ctx.capacityMinutes)} זמינות.`,
        visual: { kind: "ring", value: ctx.scheduledMinutes, max: ctx.capacityMinutes, label: `${pct}%` },
    };
};

const slack: InsightGenerator = (ctx) => {
    if (ctx.capacityMinutes === 0 || ctx.requiredMinutes === 0) return null;
    const diff = ctx.capacityMinutes - ctx.requiredMinutes;
    return diff >= 0
        ? {
            id: "slack",
            category: "schedule",
            severity: "success",
            title: `רזרבה של ${hours(diff)}`,
            body: `התוכן דורש ${hours(ctx.requiredMinutes)} ויש ${hours(ctx.capacityMinutes)}. ${percent(diff, ctx.capacityMinutes)}% מהזמן נשאר גמיש.`,
            visual: { kind: "bigNumber", value: `+${hours(diff)}`, caption: "זמן פנוי אחרי כל התוכן" },
        }
        : {
            id: "slack",
            category: "schedule",
            severity: "warning",
            title: `חסרות ${hours(-diff)}`,
            body: `התוכן דורש ${hours(ctx.requiredMinutes)} אבל בשבועות יש רק ${hours(ctx.capacityMinutes)}. צריך לקצץ או להוסיף ימים.`,
            visual: { kind: "bigNumber", value: `−${hours(-diff)}`, caption: "גירעון מול זמן העבודה" },
        };
};

const unplacedEvents: InsightGenerator = (ctx) => {
    const work = ctx.workEvents;
    if (work.length === 0) return null;
    const unplaced = work.filter((e) => !e.isPlaced);
    if (unplaced.length === 0) {
        return {
            id: "unplaced-events",
            category: "schedule",
            severity: "success",
            title: "כל המופעים ממוקמים ברצף הזמן",
            body: `כל ${work.length} המופעים שובצו. הגאנט מוכן לגזירה.`,
            visual: { kind: "ring", value: 1, max: 1, label: "100%" },
        };
    }
    return {
        id: "unplaced-events",
        category: "schedule",
        severity: "warning",
        title: `${pluralize(unplaced.length, "מופע אחד", "מופעים")} עוד לא שובצו`,
        body: `ביחד ${hours(unplaced.reduce((s, e) => s + e.totalMinutes, 0))}. למשל: ${unplaced[0].event.title}.`,
        visual: {
            kind: "ring",
            value: work.length - unplaced.length,
            max: work.length,
            label: `${percent(work.length - unplaced.length, work.length)}%`,
        },
    };
};

const weekdayLoad: InsightGenerator = (ctx) => {
    if (ctx.scheduledMinutes === 0) return null;
    const totals = new Array<number>(7).fill(0);
    for (const day of ctx.days) totals[day.dayIndex] += day.scheduledMinutes;
    const busiest = totals.indexOf(Math.max(...totals));
    return {
        id: "weekday-load",
        category: "schedule",
        severity: "info",
        title: `יום ${getDayNameDisplay(busiest)} הוא יום השיא`,
        body: `${percent(totals[busiest], ctx.scheduledMinutes)}% מהזמן המשובץ נופל על ימי ${getDayNameDisplay(busiest)}.`,
        visual: {
            kind: "weekdayHeatmap",
            cells: totals.map((value, i) => ({ label: HEBREW_DAYS_SHORT[i], value })),
        },
    };
};

const holidays: InsightGenerator = (ctx) => {
    const hits = ctx.days.flatMap((day) => {
        if (!day.date || day.capacityMinutes === 0) return [];
        const name = getHolidayComment(new Date(`${day.date.format("YYYY-MM-DD")}T00:00:00Z`));
        return name ? [ { day, name: name.split("\n")[0] } ] : [];
    });
    if (hits.length === 0) return null;
    return {
        id: "holidays",
        category: "schedule",
        severity: "warning",
        title: `${pluralize(hits.length, "יום עבודה אחד", "ימי עבודה")} נופלים על חגים`,
        body: "כדאי לוודא שבאמת עובדים בהם, או לאפס להם את השעות.",
        visual: {
            kind: "chips",
            chips: hits.slice(0, 6).map(({ day, name }) => ({
                label: `${name} (${day.date ? formatShortDate(day.date) : ""})`,
            })),
        },
    };
};

const courseTimeline: InsightGenerator = (ctx) => {
    const datedDays = ctx.days.filter((d) => d.date);
    const start = datedDays[0]?.date;
    const end = datedDays[datedDays.length - 1]?.date;
    if (!start || !end) return null;
    const totalDays = Math.max(1, end.diff(start, "day"));
    const elapsed = ctx.now.startOf("day").diff(start, "day");
    const visual: InsightVisual = {
        kind: "timeline",
        startLabel: start.format("D.M.YY"),
        endLabel: end.format("D.M.YY"),
        progress: elapsed >= 0 && elapsed <= totalDays ? elapsed / totalDays : null,
    };
    if (elapsed < 0) {
        return {
            id: "course-timeline",
            category: "schedule",
            severity: "info",
            title: `עוד ${-elapsed} ימים לפתיחת הקורס`,
            body: `${ctx.weeks.length} שבועות, מ-${visual.startLabel} ועד ${visual.endLabel}.`,
            visual,
        };
    }
    return {
        id: "course-timeline",
        category: "schedule",
        severity: "info",
        title: elapsed > totalDays ? "הקורס כבר הסתיים" : `עברו ${percent(elapsed, totalDays)}% מהקורס`,
        body: elapsed > totalDays
            ? `הוא נגמר לפני ${elapsed - totalDays} ימים. אולי הגיע הזמן להעביר לארכיון?`
            : `נשארו ${totalDays - elapsed} ימים עד ${visual.endLabel}.`,
        visual,
    };
};

const loadBalance: InsightGenerator = (ctx) => {
    const weeks = workingWeeks(ctx);
    if (weeks.length < 4 || ctx.scheduledMinutes === 0) return null;
    const half = Math.floor(weeks.length / 2);
    const ratioOf = (list: Array<InsightWeek>) =>
        list.reduce((s, w) => s + w.scheduledMinutes, 0) /
        Math.max(1, list.reduce((s, w) => s + w.capacityMinutes, 0));
    const first = ratioOf(weeks.slice(0, half));
    const second = ratioOf(weeks.slice(half));
    const isFront = first > second;
    const [ high, low ] = isFront ? [ first, second ] : [ second, first ];
    if (high < 1.5 * low) return null;
    return {
        id: "load-balance",
        category: "schedule",
        severity: "info",
        title: `הגאנט עמוס בעיקר ב${isFront ? "חציו הראשון" : "חציו השני"}`,
        body: `${Math.round(high * 100)}% ניצולת מול ${Math.round(low * 100)}% בחצי ${isFront ? "השני" : "הראשון"}.`,
        visual: weekBars(ctx),
    };
};

export const SCHEDULE_INSIGHTS: Array<InsightGenerator> = [
    unplacedEvents,
    coverage,
    slack,
    freestWeek,
    busiestWeek,
    overloadedDays,
    emptyWorkingDays,
    weekdayLoad,
    holidays,
    courseTimeline,
    loadBalance,
];
