import { ModuleEventType } from "@/api-shared/types/gantt/models";
import {
    countBy,
    hours,
    percent,
    pluralize,
    sumBy,
} from "@/components/gantt/curriculum-view/components/insights/format";
import { InsightGenerator } from "@/components/gantt/curriculum-view/components/insights/types";

const orchestratorKey = (id: null | number) => (id === null ? null : `${id}`);

const topOrchestrator: InsightGenerator = (ctx) => {
    const rows = countBy(ctx.workEvents, (e) => orchestratorKey(e.event.orchestratorId));
    if (rows.length === 0) return null;
    const [ id, count ] = rows[0];
    return {
        id: "top-orchestrator",
        category: "people",
        severity: "info",
        title: `${ctx.instructorName(Number(id))} אחראי/ת על ${count} מופעים`,
        body: `הכי הרבה בגאנט, מתוך ${rows.length} אחראים שונים.`,
        visual: {
            kind: "leaderboard",
            rows: rows.slice(0, 5).map(([ key, value ]) => ({
                label: ctx.instructorName(Number(key)),
                value,
                valueLabel: `${value}`,
            })),
        },
    };
};

const orchestratorHours: InsightGenerator = (ctx) => {
    const rows = sumBy(ctx.workEvents, (e) => orchestratorKey(e.event.orchestratorId), (e) => e.totalMinutes);
    if (rows.length < 2) return null;
    return {
        id: "orchestrator-hours",
        category: "people",
        severity: "info",
        title: `${ctx.instructorName(Number(rows[0][0]))} מוביל/ה ${hours(rows[0][1])}`,
        body: "חלוקת השעות בין האחראים, לא רק מספר המופעים.",
        visual: {
            kind: "donut",
            slices: rows.slice(0, 5).map(([ key, value ]) => ({ label: ctx.instructorName(Number(key)), value })),
            centerLabel: `${rows.length} אחראים`,
        },
    };
};

const missingOrchestrator: InsightGenerator = (ctx) => {
    const work = ctx.workEvents;
    if (work.length === 0) return null;
    const missing = work.filter((e) => e.event.orchestratorId === null);
    if (missing.length === 0) {
        return {
            id: "missing-orchestrator",
            category: "people",
            severity: "success",
            title: "לכל מופע יש אחראי",
            body: "אף מופע לא נשאר יתום.",
            visual: { kind: "ring", value: 1, max: 1, label: "100%" },
        };
    }
    const assigned = work.length - missing.length;
    return {
        id: "missing-orchestrator",
        category: "people",
        severity: "warning",
        title: `${pluralize(missing.length, "מופע אחד", "מופעים")} בלי אחראי`,
        body: `הגדול מביניהם: ${[ ...missing ].sort((a, b) => b.totalMinutes - a.totalMinutes)[0].event.title}.`,
        visual: { kind: "ring", value: assigned, max: work.length, label: `${percent(assigned, work.length)}%` },
    };
};

const busFactor: InsightGenerator = (ctx) => {
    const assigned = ctx.workEvents.filter((e) => e.event.orchestratorId !== null);
    if (assigned.length < 5) return null;
    const [ id, count ] = countBy(assigned, (e) => orchestratorKey(e.event.orchestratorId))[0];
    const share = percent(count, assigned.length);
    if (share < 40) return null;
    return {
        id: "bus-factor",
        category: "people",
        severity: "fun",
        title: "מדד האוטובוס: 1",
        body: `${ctx.instructorName(Number(id))} אחראי/ת על ${share}% מהמופעים. כדאי שלא יחצה/תחצה כבישים בזמן הקורס.`,
        visual: { kind: "bigNumber", value: `${share}%`, caption: "מהמופעים על אדם אחד" },
    };
};

const recommendedLecturers: InsightGenerator = (ctx) => {
    const rows = countBy(ctx.workEvents.flatMap((e) => e.event.recommendedLecturerIds ?? []), (id) => id);
    if (rows.length === 0) return null;
    const nameOf = (id: string) => ctx.outsiderName(id) ?? "מרצה לא ידוע/ה";
    return {
        id: "recommended-lecturers",
        category: "people",
        severity: "info",
        title: `${nameOf(rows[0][0])} מומלץ/ת ב-${rows[0][1]} מופעים`,
        body: `${pluralize(rows.length, "מרצה חיצוני אחד מומלץ", "מרצים חיצוניים מומלצים")} בגאנט.`,
        visual: {
            kind: "leaderboard",
            rows: rows.slice(0, 5).map(([ id, value ]) => ({ label: nameOf(id), value, valueLabel: `${value}` })),
        },
    };
};

const lecturesWithoutLecturer: InsightGenerator = (ctx) => {
    const lectures = ctx.workEvents.filter((e) => e.event.type === ModuleEventType.Lecture);
    if (lectures.length === 0) return null;
    const bare = lectures.filter((e) => (e.event.recommendedLecturerIds ?? []).length === 0);
    if (bare.length === 0) return null;
    return {
        id: "lectures-without-lecturer",
        category: "people",
        severity: "warning",
        title: `${pluralize(bare.length, "הרצאה אחת", "הרצאות")} בלי מרצה מומלץ`,
        body: "בלי המלצה, הגזירה והשיבוץ ישאירו את הבחירה פתוחה לגמרי.",
        visual: {
            kind: "ring",
            value: lectures.length - bare.length,
            max: lectures.length,
            label: `${lectures.length - bare.length}/${lectures.length}`,
        },
    };
};

export const PEOPLE_INSIGHTS: Array<InsightGenerator> = [
    topOrchestrator,
    orchestratorHours,
    missingOrchestrator,
    busFactor,
    recommendedLecturers,
    lecturesWithoutLecturer,
];
