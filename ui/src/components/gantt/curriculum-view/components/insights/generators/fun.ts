import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";
import {
    countBy,
    hours,
} from "@/components/gantt/curriculum-view/components/insights/format";
import { InsightGenerator } from "@/components/gantt/curriculum-view/components/insights/types";

/** Extended-edition Lord of the Rings trilogy, in minutes. */
const LOTR_EXTENDED_MINUTES = 686;
const MINUTES_PER_COFFEE = 90;
/** Words too common in Hebrew titles to be a fun fact. */
const STOP_WORDS = new Set([ "של", "על", "עם", "את", "גם", "או", "-", "–", "ו", "ה", "חלק", "מבוא" ]);

const coffee: InsightGenerator = (ctx) => {
    const minutes = ctx.workEvents.reduce((s, e) => s + e.totalMinutes, 0);
    const cups = Math.round(minutes / MINUTES_PER_COFFEE);
    if (cups < 2) return null;
    return {
        id: "coffee",
        category: "fun",
        severity: "fun",
        title: `≈${cups.toLocaleString("he-IL")} כוסות קפה`,
        body: `בקצב של כוס לכל שעה וחצי של ${hours(minutes)} תוכן. מישהו כבר הזמין פולים?`,
        visual: { kind: "bigNumber", value: "☕".repeat(Math.min(5, cups)), caption: `${cups} כוסות, בערך` },
    };
};

const lotr: InsightGenerator = (ctx) => {
    const lectureMinutes = ctx.workEvents.reduce((s, e) => s + e.totalMinutes, 0);
    const trilogies = lectureMinutes / LOTR_EXTENDED_MINUTES;
    if (trilogies < 1) return null;
    return {
        id: "lotr",
        category: "fun",
        severity: "fun",
        title: `אפשר היה לצפות ב"שר הטבעות" ${Math.floor(trilogies)} פעמים`,
        body: "בגרסה המורחבת. אבל אז אף אחד לא היה לומד כלום (חוץ מאלפית).",
        visual: { kind: "bigNumber", value: `×${trilogies.toFixed(1)}`, caption: "טרילוגיות מורחבות" },
    };
};

const longestTitle: InsightGenerator = (ctx) => {
    if (ctx.events.length < 3) return null;
    const longest = ctx.events.reduce((a, b) => (b.event.title.length > a.event.title.length ? b : a));
    if (longest.event.title.length < 30) return null;
    return {
        id: "longest-title",
        category: "fun",
        severity: "fun",
        title: `השם הארוך ביותר: ${longest.event.title.length} תווים`,
        body: `"${longest.event.title}" — מישהו התלהב.`,
    };
};

const mealCount: InsightGenerator = (ctx) => {
    const lunches = ctx.events
        .filter((e) => e.isBreak && e.event.title === MEAL_EVENT_TITLES.lunchTime)
        .reduce((s, e) => s + e.occurrences, 0);
    if (lunches < 2) return null;
    return {
        id: "meal-count",
        category: "fun",
        severity: "fun",
        title: `${lunches} הפסקות צהריים מתוכננות`,
        body: "זו כנראה השורה הכי פופולרית בגאנט.",
        visual: { kind: "bigNumber", value: `🍽️ ${lunches}`, caption: "ארוחות צהריים" },
    };
};

const favoriteWord: InsightGenerator = (ctx) => {
    const words = ctx.workEvents.flatMap((e) => e.event.title.split(/[\s,.:()"'/]+/));
    const rows = countBy(words, (w) => (w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w) ? w : null));
    if (rows.length === 0 || rows[0][1] < 3) return null;
    return {
        id: "favorite-word",
        category: "fun",
        severity: "fun",
        title: `המילה האהובה על הגאנט: "${rows[0][0]}"`,
        body: `מופיעה ב-${rows[0][1]} שמות מופעים.`,
        visual: { kind: "chips", chips: rows.slice(0, 6).map(([ label, count ]) => ({ label, count })) },
    };
};

const weekendDuty: InsightGenerator = (ctx) => {
    const duty = ctx.weeks.filter((w) => w.weekendDuty);
    if (duty.length === 0) return null;
    return {
        id: "weekend-duty",
        category: "fun",
        severity: "fun",
        title: `${duty.length} סופ"שים של תורנות`,
        body: `שבועות ${duty.map((w) => w.number).join(", ")}. כדאי לארוז כרית.`,
        visual: {
            kind: "bars",
            bars: ctx.weeks.map((w) => ({ label: `${w.number}`, value: w.weekendDuty ? 1 : 0, max: 1, highlight: w.weekendDuty })),
        },
    };
};

export const FUN_INSIGHTS: Array<InsightGenerator> = [
    coffee,
    lotr,
    longestTitle,
    mealCount,
    favoriteWord,
    weekendDuty,
];
