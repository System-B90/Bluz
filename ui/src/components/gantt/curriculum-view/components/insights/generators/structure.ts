import {
    countBy,
    percent,
} from "@/components/gantt/curriculum-view/components/insights/format";
import { InsightGenerator } from "@/components/gantt/curriculum-view/components/insights/types";
import {
    doShuffleTotalsDiffer,
    getSyllabusShuffleTotals,
} from "@/components/gantt/utils";

const shuffles: InsightGenerator = (ctx) => {
    const names = new Set<string>();
    for (const syllabusId of ctx.curriculum.syllabuses) {
        for (const name of ctx.state.syllabuses[syllabusId]?.shuffles ?? []) names.add(name);
    }
    const tagged = countBy(ctx.events.flatMap((e) => e.event.shuffles ?? []), (s) => s);
    for (const [ name ] of tagged) names.add(name);
    if (names.size === 0) return null;
    const countOf = new Map(tagged);
    const list = [ ...names ];
    return {
        id: "shuffles",
        category: "structure",
        severity: "info",
        title: list.length === 1 ? `השאפל בגאנט: ${list[0]}` : `הגאנט מתייחס ל-${list.length} שאפלים`,
        body: `${list.join(", ")}. המספר ליד כל שאפל = מופעים שתויגו אליו במפורש.`,
        visual: { kind: "chips", chips: list.map((label) => ({ label, count: countOf.get(label) ?? 0 })) },
    };
};

const shuffleImbalance: InsightGenerator = (ctx) => {
    const unequal = ctx.curriculum.syllabuses.flatMap((id) => {
        const syllabus = ctx.state.syllabuses[id];
        if (!syllabus) return [];
        const totals = getSyllabusShuffleTotals(syllabus, "minimumDuration", ctx.state);
        return doShuffleTotalsDiffer(totals) && totals ? [ { syllabus, totals } ] : [];
    });
    if (unequal.length === 0) return null;
    const { syllabus, totals } = unequal[0];
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return {
        id: "shuffle-imbalance",
        category: "structure",
        severity: "warning",
        title: `השאפלים ב"${syllabus.title}" לא מקבלים אותו זמן`,
        body: unequal.length > 1
            ? `ועוד ${unequal.length - 1} סילבוסים עם פערים בין שאפלים.`
            : "אולי זה מכוון — ואולי מופע תויג לשאפל הלא נכון.",
        visual: {
            kind: "bars",
            bars: rows.map(([ label, value ]) => ({ label, value, max: rows[0][1], highlight: value === rows[0][1] })),
        },
    };
};

const hiveLinkage: InsightGenerator = (ctx) => {
    const work = ctx.workEvents;
    if (work.length === 0) return null;
    const linked = work.filter((e) => e.event.hiveLessonId !== null).length;
    const pct = percent(linked, work.length);
    return {
        id: "hive-linkage",
        category: "structure",
        severity: pct === 100 ? "success" : pct < 50 ? "warning" : "info",
        title: `${pct}% מהמופעים מקושרים לשיעור בהייב`,
        body: pct === 100 ? "הכל מקושר. ההייב יודע בדיוק מה קורה." : `${work.length - linked} מופעים עוד בלי שיעור מקושר.`,
        visual: { kind: "ring", value: linked, max: work.length, label: `${pct}%` },
    };
};

const openComments: InsightGenerator = (ctx) => {
    const commented = ctx.events.filter((e) => e.event.comment?.trim());
    if (commented.length === 0) return null;
    return {
        id: "open-comments",
        category: "structure",
        severity: "info",
        title: `${commented.length} מופעים עם הערות`,
        body: `למשל ב${commented[0].event.title}: "${commented[0].event.comment?.trim().slice(0, 60)}"`,
        visual: { kind: "chips", chips: commented.slice(0, 6).map((e) => ({ label: e.event.title })) },
    };
};

const duplicateTitles: InsightGenerator = (ctx) => {
    const dupes = countBy(ctx.workEvents, (e) => e.event.title.trim()).filter(([ , count ]) => count > 1);
    if (dupes.length === 0) return null;
    return {
        id: "duplicate-titles",
        category: "structure",
        severity: "info",
        title: `${dupes.length} שמות מופעים חוזרים על עצמם`,
        body: "יכול להיות מכוון, ויכול להיות שכפול שנשכח.",
        visual: { kind: "chips", chips: dupes.slice(0, 6).map(([ label, count ]) => ({ label, count })) },
    };
};

const inventory: InsightGenerator = (ctx) => {
    const syllabusCount = ctx.curriculum.syllabuses.length;
    const moduleCount = ctx.curriculum.syllabuses.reduce((s, id) => s + (ctx.state.syllabuses[id]?.modules.length ?? 0), 0);
    if (ctx.events.length === 0) return null;
    return {
        id: "inventory",
        category: "structure",
        severity: "info",
        title: `${ctx.events.length} מופעים ב-${moduleCount} מערכים`,
        body: `${syllabusCount} סילבוסים, ${ctx.weeks.length} שבועות. בממוצע ${(ctx.events.length / Math.max(1, moduleCount)).toFixed(1)} מופעים למערך.`,
        visual: {
            kind: "bars",
            bars: [
                { label: "סילבוסים", value: syllabusCount, max: ctx.events.length },
                { label: "מערכים", value: moduleCount, max: ctx.events.length },
                { label: "מופעים", value: ctx.events.length, max: ctx.events.length, highlight: true },
            ],
        },
    };
};

export const STRUCTURE_INSIGHTS: Array<InsightGenerator> = [
    shuffles,
    shuffleImbalance,
    hiveLinkage,
    openComments,
    duplicateTitles,
    inventory,
];
