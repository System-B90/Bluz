import {
    EventRecurrence,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import {
    countBy,
    hours,
    percent,
    pluralize,
    sumBy,
} from "@/components/gantt/curriculum-view/components/insights/format";
import {
    InsightEvent,
    InsightGenerator,
} from "@/components/gantt/curriculum-view/components/insights/types";
import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";

const TYPE_PLURAL: Record<ModuleEventType, string> = {
    [ ModuleEventType.Lecture ]: "הרצאות",
    [ ModuleEventType.Exercise ]: "תרגול",
    [ ModuleEventType.SelfTeaching ]: "למידה עצמית",
    [ ModuleEventType.Other ]: "אחר",
};

function totalMinutes(events: Array<InsightEvent>): number {
    return events.reduce((sum, e) => sum + e.totalMinutes, 0);
}

const typeShare: InsightGenerator = (ctx) => {
    const total = totalMinutes(ctx.workEvents);
    if (total === 0) return null;
    const slices = sumBy(ctx.workEvents, (e) => e.event.type, (e) => e.totalMinutes);
    const [ topType, topMinutes ] = slices[0];
    return {
        id: "type-share",
        category: "content",
        severity: "info",
        title: `${percent(topMinutes, total)}% מהתוכן הוא ${TYPE_PLURAL[ topType as ModuleEventType ] ?? topType}`,
        body: slices.map(([ type, minutes ]) => `${type} ${percent(minutes, total)}%`).join(" · "),
        visual: {
            kind: "donut",
            slices: slices.map(([ label, value ]) => ({ label, value })),
            centerLabel: `${formatHours(total)} ש׳`,
        },
    };
};

const breakShare: InsightGenerator = (ctx) => {
    const all = totalMinutes(ctx.events);
    const breaks = totalMinutes(ctx.events.filter((e) => e.isBreak));
    if (all === 0 || breaks === 0) return null;
    const pct = percent(breaks, all);
    return {
        id: "break-share",
        category: "content",
        severity: "info",
        title: `${pct}% מתוכנית הלימודים הן הפסקות וארוחות`,
        body: `${hours(breaks)} של אוכל ומנוחה. ${pct > 25 ? "נדיב במיוחד." : "גם מוח צריך דלק."}`,
        visual: {
            kind: "donut",
            slices: [
                { label: "הפסקות", value: breaks },
                { label: "תוכן", value: all - breaks },
            ],
            centerLabel: `${pct}%`,
        },
    };
};

const syllabusShare: InsightGenerator = (ctx) => {
    const rows = sumBy(ctx.workEvents, (e) => e.syllabusTitle, (e) => e.totalMinutes);
    if (rows.length < 2) return null;
    const total = totalMinutes(ctx.workEvents);
    return {
        id: "syllabus-share",
        category: "content",
        severity: "info",
        title: `"${rows[0][0]}" תופס ${percent(rows[0][1], total)}% מהזמן`,
        body: `הסילבוס הגדול ביותר מתוך ${rows.length}.`,
        visual: {
            kind: "leaderboard",
            rows: rows.slice(0, 5).map(([ label, value ]) => ({ label, value, valueLabel: hours(value) })),
        },
    };
};

const longestEvent: InsightGenerator = (ctx) => {
    const events = ctx.workEvents.filter((e) => e.event.minimumDuration > 0);
    if (events.length === 0) return null;
    const longest = events.reduce((a, b) => (b.event.minimumDuration > a.event.minimumDuration ? b : a));
    return {
        id: "longest-event",
        category: "content",
        severity: longest.event.minimumDuration > 8 * 60 ? "warning" : "info",
        title: `המופע הארוך ביותר: ${longest.event.title}`,
        body: `${longest.syllabusTitle} › ${longest.moduleTitle}.${longest.event.minimumDuration > 8 * 60 ? " הוא יתפרס על יותר מיום אחד." : ""}`,
        visual: { kind: "bigNumber", value: hours(longest.event.minimumDuration), caption: "זמן מינימלי" },
    };
};

const shortestEvent: InsightGenerator = (ctx) => {
    const events = ctx.workEvents.filter((e) => e.event.minimumDuration > 0);
    if (events.length < 2) return null;
    const shortest = events.reduce((a, b) => (b.event.minimumDuration < a.event.minimumDuration ? b : a));
    return {
        id: "shortest-event",
        category: "content",
        severity: "info",
        title: `המופע הקצר ביותר: ${shortest.event.title}`,
        body: `${shortest.event.minimumDuration} דקות בלבד, ב${shortest.moduleTitle}.`,
        visual: { kind: "bigNumber", value: `${shortest.event.minimumDuration}′`, caption: "דקות" },
    };
};

const typicalEvent: InsightGenerator = (ctx) => {
    const durations = ctx.workEvents.map((e) => e.event.minimumDuration).filter((d) => d > 0).sort((a, b) => a - b);
    if (durations.length < 3) return null;
    const median = durations[Math.floor(durations.length / 2)];
    const average = durations.reduce((s, d) => s + d, 0) / durations.length;
    return {
        id: "typical-event",
        category: "content",
        severity: "info",
        title: `מופע טיפוסי נמשך ${hours(median)}`,
        body: `חציון ${median} דק׳, ממוצע ${Math.round(average)} דק׳, על פני ${durations.length} מופעים.`,
        visual: {
            kind: "bars",
            bars: [ 30, 60, 90, 120, 180, 240, Infinity ].map((limit, i, limits) => {
                const from = i === 0 ? 0 : limits[i - 1];
                const count = durations.filter((d) => d > from && d <= limit).length;
                return {
                    label: limit === Infinity ? `${from / 60}+` : `${limit / 60}`,
                    value: count,
                    max: durations.length,
                    highlight: median > from && median <= limit,
                };
            }),
        },
    };
};

const biggestModule: InsightGenerator = (ctx) => {
    const rows = sumBy(ctx.workEvents, (e) => `${e.event.moduleId}`, (e) => e.totalMinutes);
    if (rows.length < 2) return null;
    const titleOf = (id: string) => ctx.state.modules[id]?.title ?? id;
    return {
        id: "biggest-module",
        category: "content",
        severity: "info",
        title: `המערך הכבד ביותר: ${titleOf(rows[0][0])}`,
        body: `${hours(rows[0][1])} ב-${ctx.state.modules[rows[0][0]]?.events.length ?? 0} מופעים.`,
        visual: {
            kind: "leaderboard",
            rows: rows.slice(0, 4).map(([ id, value ]) => ({ label: titleOf(id), value, valueLabel: hours(value) })),
        },
    };
};

const emptyContainers: InsightGenerator = (ctx) => {
    const emptySyllabuses = ctx.curriculum.syllabuses
        .map((id) => ctx.state.syllabuses[id])
        .filter((s) => s && s.modules.length === 0);
    const emptyModules = ctx.curriculum.syllabuses
        .flatMap((id) => ctx.state.syllabuses[id]?.modules ?? [])
        .map((id) => ctx.state.modules[id])
        .filter((m) => m && m.events.length === 0);
    const count = emptySyllabuses.length + emptyModules.length;
    if (count === 0) return null;
    return {
        id: "empty-containers",
        category: "content",
        severity: "warning",
        title: `${count} סילבוסים/מערכים ריקים`,
        body: "אין בהם מופעים, ולכן הם לא תורמים זמן לגאנט.",
        visual: {
            kind: "chips",
            chips: [ ...emptySyllabuses, ...emptyModules ].slice(0, 6).map((item) => ({ label: item.title })),
        },
    };
};

const zeroDuration: InsightGenerator = (ctx) => {
    const zero = ctx.workEvents.filter((e) => !e.event.minimumDuration);
    if (zero.length === 0) return null;
    return {
        id: "zero-duration",
        category: "content",
        severity: "warning",
        title: `${pluralize(zero.length, "מופע אחד", "מופעים")} ללא משך`,
        body: "זמן מינימלי 0 — הם לא יתפסו מקום בגזירה.",
        visual: { kind: "chips", chips: zero.slice(0, 6).map((e) => ({ label: e.event.title })) },
    };
};

const allocationGap: InsightGenerator = (ctx) => {
    const under = ctx.workEvents.filter((e) => e.event.allocatedDuration > 0 && e.event.allocatedDuration < e.event.minimumDuration);
    if (under.length === 0) return null;
    return {
        id: "allocation-gap",
        category: "content",
        severity: "warning",
        title: `${pluralize(under.length, "מופע אחד", "מופעים")} קיבלו פחות מהזמן המינימלי`,
        body: `הזמן המוקצב שלהם קטן מהמינימום. הפער הגדול: ${under[0].event.title}.`,
        visual: {
            kind: "chips",
            chips: under.slice(0, 5).map((e) => ({ label: `${e.event.title} (−${e.event.minimumDuration - e.event.allocatedDuration}′)` })),
        },
    };
};

const recurring: InsightGenerator = (ctx) => {
    const recurringEvents = ctx.events.filter((e) => e.event.recurrence !== EventRecurrence.None);
    if (recurringEvents.length === 0) return null;
    const daily = recurringEvents.filter((e) => e.event.recurrence === EventRecurrence.Daily).length;
    const occurrences = recurringEvents.reduce((s, e) => s + e.occurrences, 0);
    return {
        id: "recurring",
        category: "content",
        severity: "info",
        title: `${recurringEvents.length} מופעים חוזרים מייצרים ${occurrences} מופעים בפועל`,
        body: `${daily} יומיים, ${recurringEvents.length - daily} שבועיים. ביחד ${hours(totalMinutes(recurringEvents))}.`,
        visual: {
            kind: "leaderboard",
            rows: [ ...recurringEvents ]
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .slice(0, 4)
                .map((e) => ({ label: e.event.title, value: e.occurrences, valueLabel: `×${e.occurrences}` })),
        },
    };
};

const critical: InsightGenerator = (ctx) => {
    const crit = ctx.workEvents.filter((e) => e.event.isCritical);
    if (crit.length === 0) return null;
    const unplaced = crit.filter((e) => !e.isPlaced);
    return {
        id: "critical",
        category: "content",
        severity: unplaced.length > 0 ? "warning" : "info",
        title: `${pluralize(crit.length, "מופע אחד", "מופעים")} מסומנים קריטיים`,
        body: unplaced.length > 0
            ? `${unplaced.length} מהם עוד לא שובצו, כולל ${unplaced[0].event.title}.`
            : "כולם כבר ממוקמים ברצף הזמן.",
        visual: {
            kind: "ring",
            value: crit.length - unplaced.length,
            max: crit.length,
            label: `${crit.length - unplaced.length}/${crit.length}`,
        },
    };
};

const paWindows: InsightGenerator = (ctx) => {
    const pa = ctx.workEvents.filter((e) => e.event.isPaWindow);
    if (pa.length === 0) return null;
    return {
        id: "pa-windows",
        category: "content",
        severity: "info",
        title: `${pluralize(pa.length, "חלון פ\"א אחד", "חלונות פ\"א")} בתוכנית`,
        body: `ביחד ${hours(totalMinutes(pa))} של זמן פ"א.`,
        visual: { kind: "chips", chips: countBy(pa, (e) => e.moduleTitle).slice(0, 6).map(([ label, count ]) => ({ label, count })) },
    };
};

const roomRequirements: InsightGenerator = (ctx) => {
    const rows = countBy(ctx.workEvents, (e) => e.event.roomRequirement);
    if (rows.length < 2) return null;
    return {
        id: "room-requirements",
        category: "content",
        severity: "info",
        title: `${rows[0][1]} מופעים דורשים "${rows[0][0]}"`,
        body: "פילוג דרישות החדר — שווה לבדוק מול זמינות החדרים.",
        visual: { kind: "chips", chips: rows.map(([ label, count ]) => ({ label, count })) },
    };
};

const systemRequirements: InsightGenerator = (ctx) => {
    const rows = countBy(ctx.workEvents.flatMap((e) => e.event.systemRequirements ?? []), (s) => s.trim());
    if (rows.length === 0) return null;
    return {
        id: "system-requirements",
        category: "content",
        severity: "info",
        title: `המערכת המבוקשת ביותר: ${rows[0][0]}`,
        body: `${pluralize(rows.length, "דרישת מערכת אחת", "דרישות מערכת שונות")}. ${rows[0][0]} נדרשת ב-${rows[0][1]} מופעים.`,
        visual: { kind: "chips", chips: rows.slice(0, 8).map(([ label, count ]) => ({ label, count })) },
    };
};

export const CONTENT_INSIGHTS: Array<InsightGenerator> = [
    typeShare,
    breakShare,
    syllabusShare,
    longestEvent,
    shortestEvent,
    typicalEvent,
    biggestModule,
    emptyContainers,
    zeroDuration,
    allocationGap,
    recurring,
    critical,
    paWindows,
    roomRequirements,
    systemRequirements,
];
