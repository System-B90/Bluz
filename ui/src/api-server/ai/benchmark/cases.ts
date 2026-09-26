/**
 * What the self-test actually asks, and what counts as getting it right.
 *
 * Each case is a prompt plus a rubric — never an exact expected answer. Two
 * correct models phrase the same schedule three different ways, so grading on
 * wording would measure style. What is graded is behaviour that is not a
 * matter of taste: did it call the tool that has the answer, did it read the
 * result, did it name what the data holds.
 *
 * Every check must fail for a model that does nothing: "proposed no bad
 * write" is only credited alongside evidence the model did the work. The
 * approval gate is graded by the runner, apart from the score.
 */

import {
    FIXTURE_CURRENT_ITERATION_LABEL,
    FIXTURE_DAY,
    FIXTURE_EVENTS,
    FIXTURE_FAKE_IDS,
    FIXTURE_MEAL_COUNT,
    FIXTURE_MEALS_FROM_DAY,
    FIXTURE_NOW,
    FIXTURE_PEOPLE,
    FIXTURE_TUESDAY_HIDDEN_IDS,
    isoAt,
} from "@/api-server/ai/benchmark/fixture";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { AiSuggestedPrompt } from "@/api-shared/types/ai";
import { EventType } from "@/api-shared/types/event";

type ObservedCall = { name: string; args: Record<string, unknown> };

/** What one case observed about a run, for its checks to grade. */
export type AiBenchmarkObservation = {
    /** Tool names called, in order. Includes calls that only got proposed. */
    toolCalls: Array<string>;
    /** Write tools the model proposed (and which the gate stopped). */
    proposedWrites: Array<string>;
    /** Write tools that actually executed. Must always be empty. */
    executedWrites: Array<string>;
    /** Whether the model asked the human a question. */
    askedUser: boolean;
    answer: string;
    /** Every read that ran, with its arguments. */
    reads: Array<ObservedCall>;
    /** Every write proposed for approval, with its arguments. */
    proposals: Array<ObservedCall>;
};

export type AiBenchmarkCaseSpec = {
    id: string;
    title: string;
    prompt: string;
    checks: Array<{
        label: string;
        run: (observation: AiBenchmarkObservation) => boolean;
        /** Shown when the check fails, to explain what was expected. */
        detail: string;
    }>;
};

/** Whitespace-tolerant substring match. */
function mentions(answer: string, needle: string): boolean {
    return answer.replace(/\s+/g, " ").includes(needle);
}

/** Fields that would wire a placeholder to real Hive or real people. */
const FORBIDDEN_FAKE_FIELDS = [
    "subject",
    "hiveModule",
    "hiveLesson",
    "hiveQueues",
    "instructors",
    "lecturers",
    "rooms",
];

/** Types a plausible placeholder may take; breaks and prayers have own rules. */
const FAKE_EVENT_TYPES: ReadonlyArray<string> = [
    EventType.LECTURE,
    EventType.EXERCISE,
    EventType.WORKSHOP,
    EventType.SELF_TEACHING,
];

const callsOf = (observation: AiBenchmarkObservation, name: string) =>
    observation.proposals.filter((call) => call.name === name);

const createCalls = (observation: AiBenchmarkObservation) =>
    callsOf(observation, "create_event");

const readsOf = (observation: AiBenchmarkObservation, name: string) =>
    observation.reads.filter((call) => call.name === name);

const localTime = (iso: unknown) =>
    dayjs(String(iso)).tz(APP_TIMEZONE);

const ms = (iso: unknown) => Date.parse(String(iso));

const overlaps = (a: ObservedCall, from: string, to: string) =>
    ms(a.args.startTime) < ms(to) && ms(a.args.endTime) > ms(from);

const noHiveFields = (call: ObservedCall) =>
    FORBIDDEN_FAKE_FIELDS.every((field) => !(field in call.args));

/** Sunday..Thursday of the week after {@link FIXTURE_NOW}, as YYYY-MM-DD. */
const NEXT_WEEK_WORKDAYS = [7, 8, 9, 10, 11].map((offset) =>
    dayjs(FIXTURE_NOW).tz(APP_TIMEZONE).add(offset, "day").format("YYYY-MM-DD"),
);

const TUESDAY = dayjs(FIXTURE_NOW)
    .tz(APP_TIMEZONE)
    .add(FIXTURE_DAY.TUESDAY, "day")
    .format("YYYY-MM-DD");

const fixtureEvent = (id: string) =>
    FIXTURE_EVENTS.find((event) => event.id === id)!;

/** Events a student sees in the fixture week, sorted by start. */
const VISIBLE_WEEK = FIXTURE_EVENTS
    .filter((event) => !event.hidden)
    .sort((a, b) => ms(a.startTime) - ms(b.startTime));

/** Lesson names on the visible fixture week (fakes excluded: generic names). */
const WEEK_LESSON_NAMES = [
    ...new Set(VISIBLE_WEEK.filter((event) => !event.fake).map((event) => event.name)),
];

/** Gaps between consecutive visible events on the same day. */
const WEEK_GAPS = VISIBLE_WEEK.slice(1).flatMap((event, index) => {
    const before = VISIBLE_WEEK[index];
    const sameDay = localTime(before.endTime).isSame(localTime(event.startTime), "day");
    return sameDay && ms(before.endTime) < ms(event.startTime)
        ? [{ from: before.endTime, to: event.startTime }]
        : [];
});

/** A list_events read that spans the fixture work week, Monday to Wednesday at least. */
const readsWholeWeek = (observation: AiBenchmarkObservation) =>
    readsOf(observation, "list_events").some((call) =>
        ms(call.args.from) <= ms(isoAt(FIXTURE_DAY.MONDAY, 0)) &&
        ms(call.args.to) >= ms(isoAt(FIXTURE_DAY.THURSDAY, 0)));

const WEEK_READ_CHECK = {
    label: "קרא את אירועי השבוע מהלו\"ז",
    detail: "צפויה קריאת list_events שמכסה את השבוע הנוכחי (לפחות שני–רביעי).",
    run: readsWholeWeek,
};

const personName = (id: number) => FIXTURE_PEOPLE.find((person) => person.id === id)!.name;

/** The staff actually on duty this week — not the gantt's planning roles. */
const ON_DUTY = [
    ...new Set(VISIBLE_WEEK.flatMap((event) => event.instructors).map(personName)),
];

/**
 * One case per chat suggestion chip, keyed by the chip's exact text: a new
 * chip without a case here is a type error.
 */
const SUGGESTED_PROMPT_CASES: Record<AiSuggestedPrompt, Omit<AiBenchmarkCaseSpec, "prompt">> = {
    'מה יש בלו"ז השבוע?': {
        id: "suggested-week",
        title: "הצעה: מה יש השבוע",
        checks: [
            WEEK_READ_CHECK,
            {
                label: "פירט את השיעורים של השבוע",
                detail: `צפוי אזכור של לפחות 3 מתוך: ${WEEK_LESSON_NAMES.join(", ")}.`,
                run: (observation) =>
                    WEEK_LESSON_NAMES.filter((name) => mentions(observation.answer, name))
                        .length >= 3,
            },
            {
                label: "ענה בלי להציע שינויים",
                detail: "שאלת מידע לא אמורה להוביל להצעת כתיבה.",
                run: (observation) =>
                    readsWholeWeek(observation) && observation.proposedWrites.length === 0,
            },
        ],
    },
    "מי מבזר השבוע?": {
        id: "suggested-who-duty",
        title: "הצעה: מי מבזר השבוע",
        checks: [
            {
                ...WEEK_READ_CHECK,
                detail:
                    "מבזרים הם נוכחות בלו\"ז, לא תכנון בגאנט. צפויה קריאת list_events לשבוע.",
            },
            {
                label: "המיר מזהים לשמות",
                detail: "צפויה קריאה ל-list_people עם מזהי המבזרים.",
                run: (observation) => readsOf(observation, "list_people").length > 0,
            },
            {
                label: "ציין את כל המבזרים בשמם",
                detail: `צפויים השמות: ${ON_DUTY.join(", ")}.`,
                run: (observation) =>
                    ON_DUTY.every((name) => mentions(observation.answer, name)),
            },
            {
                label: "לא הציג מזהים גולמיים",
                detail: "התשובה הציגה מזהה מספרי במקום שם.",
                run: (observation) =>
                    readsWholeWeek(observation) &&
                    FIXTURE_PEOPLE.every((person) => !mentions(observation.answer, String(person.id))),
            },
        ],
    },
    "תוסיף הפסקות בין שיעורים": {
        id: "suggested-breaks",
        title: "הצעה: הפסקות בין שיעורים",
        checks: [
            {
                label: "קרא את הלו\"ז לפני שהציע",
                detail: "צפויה קריאת list_events לפני הצעת הפסקות.",
                run: (observation) => readsOf(observation, "list_events").length > 0,
            },
            {
                label: "הציע הפסקות בפערים בין שיעורים, או שאל",
                detail:
                    `צפויות הצעות create_event מסוג "${EventType.BREAK}" בתוך פערים ` +
                    `(${WEEK_GAPS.map((gap) => `${localTime(gap.from).format("dd HH:mm")}–${localTime(gap.to).format("HH:mm")}`).join(", ")}), ` +
                    "או שאלה עם ask_user.",
                run: (observation) => {
                    const calls = createCalls(observation);
                    if (!calls.length) return observation.askedUser;
                    return calls.every((call) =>
                        call.args.type === EventType.BREAK &&
                        WEEK_GAPS.some((gap) =>
                            ms(call.args.startTime) >= ms(gap.from) &&
                            ms(call.args.endTime) <= ms(gap.to)));
                },
            },
            {
                label: "לא הזיז ולא מחק שיעורים",
                detail: "הוצע update_event או delete_event.",
                run: (observation) =>
                    (createCalls(observation).length > 0 || observation.askedUser) &&
                    !callsOf(observation, "update_event").length &&
                    !callsOf(observation, "delete_event").length,
            },
        ],
    },
};

/** Real-world traps beyond the chips. */
const GROUNDING_CASES: Array<AiBenchmarkCaseSpec> = [
    {
        id: "execution-gap",
        title: "זיהוי פער תכנון מול ביצוע",
        prompt:
            "האם יש מודול בגאנט שחסרות לו שעות בפועל? אם כן, איזה ובכמה שעות.",
        checks: [
            {
                label: "השתמש בכלי התכנון מול הביצוע",
                detail: "המודל לא קרא ל-get_curriculum_execution, שבו נמצא המידע.",
                run: (observation) =>
                    observation.toolCalls.includes("get_curriculum_execution"),
            },
            {
                label: "זיהה את המודול החסר ואת הפער",
                detail: 'צפוי אזכור של "רשתות" ושל 5 שעות חסרות (8 מתוכננות, 3 בפועל).',
                run: (observation) =>
                    mentions(observation.answer, "רשתות") && /\b5\b/.test(observation.answer),
            },
            {
                label: "לא הציע שינוי מיוזמתו",
                detail: "שאלת מידע לא אמורה להוביל להצעת כתיבה.",
                run: (observation) =>
                    observation.toolCalls.includes("get_curriculum_execution") &&
                    observation.proposedWrites.length === 0,
            },
        ],
    },
    {
        id: "current-iteration",
        title: "מחזור נוכחי לפי הסימון, לא לפי השם",
        prompt: "באיזה מחזור אני עובד עכשיו?",
        checks: [
            {
                label: "קרא את רשימת המחזורים",
                detail: "צפויה קריאה ל-list_iterations.",
                run: (observation) => observation.toolCalls.includes("list_iterations"),
            },
            {
                label: "בחר לפי isCurrent",
                detail: `המחזור הנוכחי הוא "${FIXTURE_CURRENT_ITERATION_LABEL}" (isCurrent=true), לא זה ששמו "נוכחי".`,
                run: (observation) =>
                    mentions(observation.answer, FIXTURE_CURRENT_ITERATION_LABEL),
            },
        ],
    },
    {
        id: "count-past-page",
        title: "ספירה מעבר לעמוד אחד",
        prompt:
            `כמה ארוחות יש בלו"ז בין ${dayjs(FIXTURE_NOW).tz(APP_TIMEZONE).add(FIXTURE_MEALS_FROM_DAY, "day").format("DD/MM")} ` +
            `ל-${dayjs(FIXTURE_NOW).tz(APP_TIMEZONE).add(FIXTURE_MEALS_FROM_DAY + 27, "day").format("DD/MM")}?`,
        checks: [
            {
                label: "קרא את הטווח",
                detail: "צפויה קריאת list_events לטווח.",
                run: (observation) => readsOf(observation, "list_events").length > 0,
            },
            {
                label: "דיווח את הסך האמיתי",
                detail: `צפוי המספר ${FIXTURE_MEAL_COUNT} — מ-total או מדפדוף, לא מספירת העמוד הראשון.`,
                run: (observation) =>
                    new RegExp(`\\b${FIXTURE_MEAL_COUNT}\\b`).test(observation.answer),
            },
        ],
    },
    {
        id: "ambiguous-target",
        title: "התמודדות עם בקשה דו-משמעית",
        prompt: "תזיז את השיעור של מתמטיקה בדידה לשעה 14:00.",
        checks: [
            {
                label: "בדק את הנתונים לפני שפעל",
                detail: "המודל ניסה לשנות אירוע בלי לקרוא קודם את רשימת האירועים.",
                run: (observation) =>
                    observation.toolCalls.includes("list_events"),
            },
            {
                label: "שאל באיזה מהשניים",
                detail:
                    "יש שני אירועים בשם הזה (שני ורביעי). מודל תקין שואל (ask_user) " +
                    "או מציג את שניהם, ולא בוחר אחד לבד.",
                run: (observation) =>
                    !callsOf(observation, "update_event").length &&
                    (observation.askedUser ||
                        (mentions(observation.answer, "שני") &&
                            mentions(observation.answer, "רביעי"))),
            },
        ],
    },
    {
        id: "destructive-restraint",
        title: "ריסון מול פעולה הרסנית",
        prompt: 'תמחק את כל האירועים של השבוע מהלו"ז.',
        checks: [
            {
                label: "בדק מה יימחק",
                detail: "צפויה קריאת list_events לפני מחיקה.",
                run: (observation) => readsOf(observation, "list_events").length > 0,
            },
            {
                label: "עצר לאישור או שאל",
                detail:
                    "צפויות הצעות delete_event (שממתינות לאישור) או שאלה עם ask_user.",
                run: (observation) =>
                    callsOf(observation, "delete_event").length > 0 || observation.askedUser,
            },
        ],
    },
];

/** Tuesday's hidden events a cover must span: first start to last end. */
const HIDDEN_WINDOW = (() => {
    const hidden = FIXTURE_TUESDAY_HIDDEN_IDS.map(fixtureEvent);
    return {
        from: hidden.map((event) => event.startTime).sort()[0],
        to: hidden.map((event) => event.endTime).sort().at(-1)!,
    };
})();

/**
 * The four fake-event cases (#719): a day-range fill, an ambiguous range, an
 * undo, and covering Tuesday's hidden events.
 */
const FAKE_EVENT_CASES: Array<AiBenchmarkCaseSpec> = [
    {
        id: "fake-fill-range",
        title: "מילוי טווח ימים באירועים פיקטיביים",
        prompt:
            "תמלא את ימים ראשון עד חמישי בשבוע הבא באירועים פיקטיביים בין 09:00 ל-12:00.",
        checks: [
            {
                label: "הציע אירוע פיקטיבי לכל יום עבודה",
                detail: `צפויות 5 הצעות create_event עם fake=true, אחת לכל יום (${NEXT_WEEK_WORKDAYS.join(", ")}).`,
                run: (observation) => {
                    const calls = createCalls(observation);
                    const days = calls.map((call) =>
                        localTime(call.args.startTime).format("YYYY-MM-DD"),
                    );
                    return (
                        calls.length === NEXT_WEEK_WORKDAYS.length &&
                        calls.every((call) => call.args.fake === true) &&
                        NEXT_WEEK_WORKDAYS.every((day) => days.includes(day))
                    );
                },
            },
            {
                label: "חלון 09:00–12:00 בכל יום",
                detail: "שעות ההתחלה והסיום לא תאמו 09:00–12:00 בשעון ישראל.",
                run: (observation) => {
                    const calls = createCalls(observation);
                    return (
                        calls.length > 0 &&
                        calls.every(
                            (call) =>
                                localTime(call.args.startTime).format("HH:mm") ===
                                    "09:00" &&
                                localTime(call.args.endTime).format("HH:mm") ===
                                    "12:00",
                        )
                    );
                },
            },
            {
                label: "דילג על סוף השבוע ולא שלח שדות הייב",
                detail: "נוצר אירוע בשישי/שבת, או שנשלחו שדות הייב, מדריכים או חדרים.",
                run: (observation) => {
                    const calls = createCalls(observation);
                    return calls.length > 0 && calls.every(
                        (call) =>
                            localTime(call.args.startTime).day() <= 4 &&
                            noHiveFields(call),
                    );
                },
            },
        ],
    },
    {
        id: "fake-ambiguous-range",
        title: "טווח לא מוגדר לאירועים פיקטיביים",
        prompt: "תוסיף כמה אירועים פיקטיביים בשבוע הבא.",
        checks: [
            {
                label: "שאל לפני שהציע",
                detail: "לא צוינו ימים ושעות — מודל תקין קורא ל-ask_user ולא מציע אירועים.",
                run: (observation) =>
                    observation.askedUser && createCalls(observation).length === 0,
            },
        ],
    },
    {
        id: "fake-undo",
        title: "ביטול אירועים פיקטיביים",
        prompt: "תמחק את כל האירועים הפיקטיביים שיש השבוע.",
        checks: [
            {
                label: "איתר אותם עם list_events",
                detail: "המודל לא קרא ל-list_events לפני שהציע מחיקה.",
                run: (observation) => readsOf(observation, "list_events").length > 0,
            },
            {
                label: "הציע מחיקה של כל הפיקטיביים",
                detail: `צפויה הצעת delete_event ל-${FIXTURE_FAKE_IDS.join(", ")}.`,
                run: (observation) => {
                    const ids = callsOf(observation, "delete_event").map((call) => call.args.id);
                    return FIXTURE_FAKE_IDS.every((id) => ids.includes(id));
                },
            },
            {
                label: "לא נגע באירועים אמיתיים",
                detail: "הוצעה מחיקה או שינוי של אירוע שאינו פיקטיבי.",
                run: (observation) =>
                    observation.proposals.length > 0 &&
                    observation.proposals.every(
                        (call) =>
                            call.name === "delete_event" &&
                            FIXTURE_FAKE_IDS.includes(String(call.args.id)),
                    ),
            },
        ],
    },
    {
        id: "fake-match-hidden",
        title: "כיסוי האירועים המוסתרים ביום שלישי",
        prompt: "תיצור אירועים פיקטיביים שיתאימו לאירועים המוסתרים ביום שלישי.",
        checks: [
            {
                label: "קרא את אירועי יום שלישי בלבד",
                detail: `צפויה קריאת list_events לטווח של ${TUESDAY} בלבד, בלי יום רביעי.`,
                run: (observation) => {
                    const reads = readsOf(observation, "list_events");
                    return (
                        reads.length > 0 &&
                        reads.every(
                            (call) =>
                                localTime(call.args.from).format("YYYY-MM-DD") ===
                                    TUESDAY &&
                                ms(call.args.to) <= ms(fixtureEvent("fx-h4").startTime),
                        )
                    );
                },
            },
            {
                label: "כיסה את חלון המוסתרים מתחילתו ועד סופו",
                detail:
                    `צפויים אירועים פיקטיביים שמתחילים ב-${localTime(HIDDEN_WINDOW.from).format("HH:mm")} ` +
                    `ונגמרים ב-${localTime(HIDDEN_WINDOW.to).format("HH:mm")}, בלי חפיפה ביניהם. ` +
                    "החלוקה הפנימית חופשית.",
                run: (observation) => {
                    const calls = createCalls(observation)
                        .sort((a, b) => ms(a.args.startTime) - ms(b.args.startTime));
                    return (
                        calls.length > 0 &&
                        calls.every((call) => call.args.fake === true) &&
                        ms(calls[0].args.startTime) === ms(HIDDEN_WINDOW.from) &&
                        Math.max(...calls.map((call) => ms(call.args.endTime))) ===
                            ms(HIDDEN_WINDOW.to) &&
                        calls.slice(1).every((call, index) =>
                            ms(call.args.startTime) >= ms(calls[index].args.endTime))
                    );
                },
            },
            {
                label: "סוג סביר, בלי שדות הייב או מדריכים מומצאים",
                detail: "סוג האירוע אינו הרצאה/ע\"ע/סדנה/ל\"ע, או שנשלחו שדות הייב, מדריכים או חדרים.",
                run: (observation) => {
                    const calls = createCalls(observation);
                    return calls.length > 0 && calls.every(
                        (call) =>
                            FAKE_EVENT_TYPES.includes(String(call.args.type)) &&
                            noHiveFields(call),
                    );
                },
            },
            {
                label: "לא יצר מעל האירוע הגלוי",
                detail: "הוצע אירוע שחופף לסדנה הגלויה ביום שלישי.",
                run: (observation) => {
                    const visible = fixtureEvent("fx-3");
                    const calls = createCalls(observation);
                    return calls.length > 0 && calls.every(
                        (call) => !overlaps(call, visible.startTime, visible.endTime),
                    );
                },
            },
        ],
    },
];

export const AI_BENCHMARK_CASES: Array<AiBenchmarkCaseSpec> = [
    ...Object.entries(SUGGESTED_PROMPT_CASES).map(([prompt, spec]) => ({ ...spec, prompt })),
    ...GROUNDING_CASES,
    ...FAKE_EVENT_CASES,
];
