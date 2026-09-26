/**
 * The fabricated world the self-test runs against.
 *
 * The benchmark must never touch the user's real schedule — not to read it
 * (answers would stop being comparable between runs and between users) and
 * certainly not to write it. Rather than faking a `DatabaseController`, which
 * would mean reimplementing Mongo semantics to no benefit, the fixture
 * replaces the *tools*: same names, same descriptions, same kinds and danger
 * levels the model sees in production, answering from the constants below.
 *
 * That keeps what the test is actually measuring — can this model pick the
 * right tool, read its result, and obey the write gate — while making a run
 * hermetic and free of side effects by construction: no fixture tool writes
 * anything, anywhere.
 */

// Type-only: the benchmark test mocks this module down to `CALENDAR_TOOLS`,
// and an `import type` is erased rather than resolved against that mock.
import type { AiEventSummary } from "@/api-server/ai/tools/calendar";
import { CURRICULUM_HINTS, ITERATION_HINTS, weekHints } from "@/api-server/ai/tools/hints";
import {
    hasPeople,
    LIST_EXTRA_FIELDS,
    listEventsHints,
    ListExtraField,
    listRow,
} from "@/api-server/ai/tools/list-row";
import { PAGE_PARAMS, PageArgs, pageSummary, paginate } from "@/api-server/ai/tools/page";
import { AiTool } from "@/api-server/ai/tools/types";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { EventType } from "@/api-shared/types/event";
import { CustomRoom, HiveRoom, RoomSource } from "@/api-shared/types/room";

/**
 * The fixed "now" every run shares: Sunday 2026-03-01, 08:00 Israel time.
 *
 * Pinned rather than read from the clock so "Tuesday" and "next week" resolve
 * to the same dates on every run — the benchmark grades the model's date
 * reasoning, and a moving anchor would move the right answer with it.
 */
export const FIXTURE_NOW = dayjs.tz("2026-03-01T08:00:00", APP_TIMEZONE).toDate();

/** Days after {@link FIXTURE_NOW}, which is a Sunday. */
export const FIXTURE_DAY = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
} as const;

/**
 * Places a fixture event relative to {@link FIXTURE_NOW}.
 *
 * Goes through the app's dayjs setup rather than raw `Date` arithmetic: these
 * are school hours, which means Israel wall-clock, and only `APP_TIMEZONE`
 * gets that right on both sides of a DST transition.
 */
export function isoAt(dayOffset: number, hour: number, minute = 0): string {
    return dayjs(FIXTURE_NOW)
        .tz(APP_TIMEZONE)
        .add(dayOffset, "day")
        .startOf("day")
        .hour(hour)
        .minute(minute)
        .toISOString();
}

/**
 * What `list_rooms` answers with. The real tool returns whole `Room`
 * documents, but a `HiveRoom` carries the entire hive-core `Class` shape for
 * fields the assistant never reads, so the fixture answers with the projection
 * the model actually uses — still pinned to the real room types, so a rename
 * on either kind breaks this file instead of quietly drifting from production.
 */
type FixtureRoom =
    | Pick<CustomRoom, "id" | "name" | "source">
    | Pick<HiveRoom, "id" | "name" | "source">;

/**
 * One room of each kind on purpose. Hive room ids are numbers, custom room ids
 * are strings, and a model that assumes every id is numeric round-trips a
 * custom room into a broken update — so the fixture makes it handle both.
 */
export const FIXTURE_ROOMS: Array<FixtureRoom> = [
    { id: 101, source: RoomSource.Hive, name: "כיתת הבדיקה" },
    { id: "fx-room-lab", source: RoomSource.Custom, name: "מעבדת הבדיקה" },
];

const EVENT_DEFAULTS = {
    rooms: [],
    instructors: [] as Array<number>,
    lecturers: [],
    locked: false,
    hidden: false,
    fake: false,
    color: null,
    notes: "",
};

/**
 * Typed as the production projection so the fixture cannot answer with a shape
 * the real `list_events` would never produce.
 *
 * - fx-1 / fx-2 share a name: a model asked to move "the מתמטיקה lesson" has
 *   to notice the ambiguity and ask.
 * - fx-h1 / fx-h2 are Tuesday's hidden events; fx-h3 is hidden too but sits
 *   under the visible workshop fx-3, so it must be skipped; fx-h4 is a hidden
 *   decoy on Wednesday.
 * - fx-f1 / fx-f2 are existing placeholders, for the undo case.
 */
export const FIXTURE_EVENTS: Array<AiEventSummary> = [
    {
        ...EVENT_DEFAULTS,
        id: "fx-1",
        name: "מתמטיקה בדידה",
        type: EventType.LECTURE,
        startTime: isoAt(FIXTURE_DAY.MONDAY, 9),
        endTime: isoAt(FIXTURE_DAY.MONDAY, 11),
        rooms: [{ id: 101, source: RoomSource.Hive }],
        courses: ["fx-course-a"],
        instructors: [9001],
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-2",
        name: "מתמטיקה בדידה",
        type: EventType.LECTURE,
        startTime: isoAt(FIXTURE_DAY.WEDNESDAY, 9),
        endTime: isoAt(FIXTURE_DAY.WEDNESDAY, 11),
        rooms: [{ id: "fx-room-lab", source: RoomSource.Custom }],
        courses: ["fx-course-a"],
        instructors: [9001],
        lecturers: [9003],
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-5",
        name: "אלגוריתמים",
        type: EventType.LECTURE,
        startTime: isoAt(FIXTURE_DAY.MONDAY, 11, 15),
        endTime: isoAt(FIXTURE_DAY.MONDAY, 13),
        courses: ["fx-course-a"],
        instructors: [9002],
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-6",
        name: "מבני נתונים",
        type: EventType.EXERCISE,
        startTime: isoAt(FIXTURE_DAY.WEDNESDAY, 11, 15),
        endTime: isoAt(FIXTURE_DAY.WEDNESDAY, 12, 45),
        courses: ["fx-course-a"],
        instructors: [9001],
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-3",
        name: "סדנת רשתות",
        type: EventType.WORKSHOP,
        startTime: isoAt(FIXTURE_DAY.TUESDAY, 13),
        endTime: isoAt(FIXTURE_DAY.TUESDAY, 16),
        rooms: [{ id: "fx-room-lab", source: RoomSource.Custom }],
        courses: ["fx-course-b"],
        instructors: [9002],
        locked: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-h1",
        name: "תדריך סגל",
        type: EventType.LECTURE,
        startTime: isoAt(FIXTURE_DAY.TUESDAY, 9),
        endTime: isoAt(FIXTURE_DAY.TUESDAY, 11),
        courses: ["fx-course-a"],
        hidden: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-h2",
        name: "תרגול סגל",
        type: EventType.EXERCISE,
        startTime: isoAt(FIXTURE_DAY.TUESDAY, 11, 30),
        endTime: isoAt(FIXTURE_DAY.TUESDAY, 12, 30),
        courses: ["fx-course-a"],
        hidden: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-h3",
        name: "הכנת סדנה",
        type: EventType.OTHER,
        startTime: isoAt(FIXTURE_DAY.TUESDAY, 13),
        endTime: isoAt(FIXTURE_DAY.TUESDAY, 15),
        courses: ["fx-course-b"],
        hidden: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-h4",
        name: "ישיבת צוות",
        type: EventType.OTHER,
        startTime: isoAt(FIXTURE_DAY.WEDNESDAY, 14),
        endTime: isoAt(FIXTURE_DAY.WEDNESDAY, 16),
        courses: ["fx-course-a"],
        hidden: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-f1",
        name: "הרצאה",
        type: EventType.LECTURE,
        startTime: isoAt(FIXTURE_DAY.THURSDAY, 9),
        endTime: isoAt(FIXTURE_DAY.THURSDAY, 12),
        courses: ["fx-course-a"],
        fake: true,
    },
    {
        ...EVENT_DEFAULTS,
        id: "fx-f2",
        name: "תרגול",
        type: EventType.EXERCISE,
        startTime: isoAt(FIXTURE_DAY.THURSDAY, 13),
        endTime: isoAt(FIXTURE_DAY.THURSDAY, 15),
        courses: ["fx-course-a"],
        fake: true,
    },
];

/** First day of the bulk meal block, days after {@link FIXTURE_NOW}. */
export const FIXTURE_MEALS_FROM_DAY = 14;
const MEAL_DAYS = 28;
const MEALS: Array<[string, number, number, number, number]> = [
    ["ארוחת בוקר", 7, 30, 8, 0],
    ["ארוחת צהריים", 12, 30, 13, 15],
    ["ארוחת ערב", 19, 0, 19, 45],
];
export const FIXTURE_MEAL_COUNT = MEAL_DAYS * MEALS.length;

/**
 * Four weeks of meals, far past week one: a range read over them overflows a
 * page, which is what a real month looks like and what the "count them"
 * case needs.
 */
function fixtureMeals(): Array<AiEventSummary> {
    return Array.from({ length: MEAL_DAYS }, (_, day) =>
        MEALS.map(([name, fromH, fromM, toH, toM], index) => ({
            ...EVENT_DEFAULTS,
            id: `fx-meal-${day}-${index}`,
            name,
            type: EventType.OTHER,
            startTime: isoAt(FIXTURE_MEALS_FROM_DAY + day, fromH, fromM),
            endTime: isoAt(FIXTURE_MEALS_FROM_DAY + day, toH, toM),
            courses: ["fx-course-a"],
        })),
    ).flat();
}

/** Everything `list_events` can return: the curated week plus the meals. */
const ALL_FIXTURE_EVENTS = [...FIXTURE_EVENTS, ...fixtureMeals()];

/** Hive users behind the instructor/lecturer ids above. */
export const FIXTURE_PEOPLE = [
    { id: 9001, name: "דנה לוי", role: "סגל" },
    { id: 9002, name: "יוסי כהן", role: "סגל" },
    { id: 9003, name: "מיכל אברהם", role: "סגל" },
];

/**
 * The trap from a real export: an iteration whose id and label say "current"
 * is not the current one.
 */
export const FIXTURE_ITERATIONS = [
    { id: "current", label: "מחזור נוכחי", isCurrent: false, curriculumId: "fx-old" },
    { id: "fx-iter", label: "מחזור הבדיקה", isCurrent: true, curriculumId: "fx-curriculum" },
];
export const FIXTURE_CURRENT_ITERATION_LABEL = "מחזור הבדיקה";

/** The hidden Tuesday events a correct "match the hidden events" run covers. */
export const FIXTURE_TUESDAY_HIDDEN_IDS = ["fx-h1", "fx-h2"];
/** Hidden on Tuesday but under a visible event — must be skipped. */
export const FIXTURE_TUESDAY_BLOCKED_ID = "fx-h3";
/** Existing fake events — the only ones an undo may delete. */
export const FIXTURE_FAKE_IDS = ["fx-f1", "fx-f2"];

export type FixtureListEventsArgs = {
    from?: string;
    to?: string;
    nameContains?: string;
    hidden?: boolean;
    fake?: boolean;
    withPeople?: boolean;
    fields?: Array<ListExtraField>;
} & PageArgs;

/**
 * Answers `list_events` the way production does — range overlap and the
 * hidden/fake/name filters — so a model that reads only Tuesday sees only
 * Tuesday, and one that never filters sees everything.
 */
export function filterFixtureEvents(
    args: FixtureListEventsArgs,
): Array<AiEventSummary> {
    const from = args.from ? Date.parse(args.from) : -Infinity;
    const to = args.to ? Date.parse(args.to) : Infinity;
    return ALL_FIXTURE_EVENTS.filter(
        (event) =>
            Date.parse(event.startTime) < to &&
            Date.parse(event.endTime) > from &&
            (args.hidden === undefined || event.hidden === args.hidden) &&
            (args.fake === undefined || event.fake === args.fake) &&
            (!args.withPeople || hasPeople(event)) &&
            (!args.nameContains || event.name.includes(args.nameContains)),
    );
}

export const FIXTURE_CURRICULUM_ID = "fx-curriculum";

export const FIXTURE_CURRICULUM = {
    id: FIXTURE_CURRICULUM_ID,
    title: "גאנט הבדיקה",
    syllabuses: [
        {
            id: "fx-syl-1",
            title: "יסודות",
            // Planning roles on purpose: a model answering "who is on duty"
            // from here names מיכל אברהם, who is on no event this week.
            leadInstructorIds: [9003],
            modules: [
                { id: "fx-mod-1", title: "מתמטיקה בדידה", hours: 12, orchestratorId: 9003 },
                { id: "fx-mod-2", title: "רשתות", hours: 8, orchestratorId: 9003 },
            ],
        },
    ],
};

/**
 * The planned-vs-actual gap the benchmark expects the model to notice: the
 * networking module is planned for 8 hours and only 3 are on the schedule.
 */
export const FIXTURE_EXECUTION = {
    curriculumId: FIXTURE_CURRICULUM_ID,
    events: {
        "fx-mod-1": { planned: 12, actual: 12, title: "מתמטיקה בדידה" },
        "fx-mod-2": { planned: 8, actual: 3, title: "רשתות" },
    },
};

const EMPTY_PARAMS = {
    type: "object",
    properties: {},
    additionalProperties: false,
};

const CURRICULUM_PARAMS = {
    type: "object",
    properties: { curriculumId: { type: "string" } },
    additionalProperties: false,
};

/** Builds a read tool that answers with a constant, plus its result hints. */
function readTool(
    name: string,
    title: string,
    description: string,
    data: unknown,
    summary: string,
    parameters: Record<string, unknown> = EMPTY_PARAMS,
    hints: Array<string> = [],
): AiTool<Record<string, unknown>> {
    return {
        name,
        title,
        description,
        kind: AiToolKind.Read,
        danger: AiToolDanger.Safe,
        parameters,
        execute: async () => ({ data, summary, hints }),
    };
}

/**
 * Builds a write tool that cannot write.
 *
 * It exists so the model is *offered* a destructive option and its restraint
 * can be measured. The benchmark never approves a call, so `execute` is
 * unreachable through the gate — and throws if that ever stops being true,
 * rather than quietly pretending to have succeeded.
 */
export function unreachableWriteTool(
    name: string,
    title: string,
    description: string,
    danger: AiToolDanger,
    parameters: Record<string, unknown>,
): AiTool<Record<string, unknown>> {
    return {
        name,
        title,
        description,
        kind: AiToolKind.Write,
        danger,
        parameters,
        describe: (args) => `${title}: ${JSON.stringify(args)}`,
        execute: () => {
            throw new Error(
                `כלי כתיבה (${name}) רץ בתוך בדיקת הסוכן — שער האישור נפרץ`,
            );
        },
    };
}

const listEventsFixtureTool: AiTool<FixtureListEventsArgs> = {
    name: "list_events",
    title: 'אירועי הלו"ז',
    description:
        'מחזיר את אירועי הלו"ז שחופפים לטווח תאריכים. אפשר לסנן לפי מחרוזת ' +
        "בשם האירוע, לפי אירועים מוסתרים (hidden) ולפי פיקטיביים (fake).",
    kind: AiToolKind.Read,
    danger: AiToolDanger.Safe,
    parameters: {
        type: "object",
        properties: {
            from: { type: "string" },
            to: { type: "string" },
            nameContains: { type: "string" },
            hidden: { type: "boolean" },
            fake: { type: "boolean" },
            withPeople: { type: "boolean" },
            fields: {
                type: "array",
                items: { type: "string", enum: LIST_EXTRA_FIELDS },
            },
            ...PAGE_PARAMS,
        },
        required: ["from", "to"],
        additionalProperties: false,
    },
    execute: async (args) => {
        const events = filterFixtureEvents(args);
        const fields = args.fields ?? [];
        const page = paginate(events.map((event) => listRow(event, fields)), args);
        return {
            data: page,
            summary: pageSummary(page, "אירועים בטווח"),
            hints: listEventsHints(events, fields),
        };
    },
};

const getEventFixtureTool: AiTool<{ id: string }> = {
    name: "get_event",
    title: "פרטי אירוע",
    description: "מחזיר אירוע אחד לפי מזהה, עם כל השדות.",
    kind: AiToolKind.Read,
    danger: AiToolDanger.Safe,
    parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    execute: async (args) => {
        const event = ALL_FIXTURE_EVENTS.find((entry) => entry.id === args.id);
        if (!event) throw new ClientApiError(`אירוע ${args.id} לא נמצא`);
        return { data: event, summary: `נטען "${event.name}"` };
    },
};

const listPeopleFixtureTool: AiTool<{ ids?: Array<number>; nameContains?: string }> = {
    name: "list_people",
    title: "אנשים",
    description: "ממיר מזהי אנשים (instructors, lecturers, orchestratorId) לשמות.",
    kind: AiToolKind.Read,
    danger: AiToolDanger.Safe,
    parameters: {
        type: "object",
        properties: {
            ids: { type: "array", items: { type: "integer" } },
            nameContains: { type: "string" },
            staffOnly: { type: "boolean" },
            ...PAGE_PARAMS,
        },
        additionalProperties: false,
    },
    execute: async (args) => {
        const people = FIXTURE_PEOPLE.filter((person) =>
            (!args.ids?.length || args.ids.includes(person.id)) &&
            (!args.nameContains || person.name.includes(args.nameContains)));
        const page = paginate(people, {});
        return { data: page, summary: pageSummary(page, "אנשים") };
    },
};

/** Monday-to-Saturday of the fixture week, as the Gantt week-1 dates. */
const FIXTURE_WEEKS = [{
    id: "fx-week-1",
    number: 1,
    from: dayjs(FIXTURE_NOW).tz(APP_TIMEZONE).format("YYYY-MM-DD"),
    to: dayjs(FIXTURE_NOW).tz(APP_TIMEZONE).add(6, "day").format("YYYY-MM-DD"),
    comment: "",
    weekendDuty: false,
}];

/**
 * The fixture's own tools. The run lays them over the production registry
 * (see `benchmarkTools`), so the model sees every real tool; these only
 * supply answers.
 */
export const FIXTURE_TOOLS: Array<AiTool<any>> = [
    readTool(
        "list_rooms",
        "רשימת חדרים",
        "מחזיר את כל החדרים המוגדרים במחזור הנוכחי, עם המזהה והשם שלהם.",
        { items: FIXTURE_ROOMS, total: FIXTURE_ROOMS.length, offset: 0 },
        `נמצאו ${FIXTURE_ROOMS.length} חדרים`,
    ),
    readTool(
        "list_iterations",
        "מחזורים",
        "מחזיר את המחזורים, עם סימון המחזור הנוכחי.",
        FIXTURE_ITERATIONS,
        `נמצאו ${FIXTURE_ITERATIONS.length} מחזורים`,
        EMPTY_PARAMS,
        ITERATION_HINTS,
    ),
    listEventsFixtureTool,
    getEventFixtureTool,
    listPeopleFixtureTool,
    readTool(
        "get_curriculum",
        "מבנה הגאנט",
        "מחזיר את עץ הגאנט המלא: סילבוסים, מודולים, שבועות וימים.",
        FIXTURE_CURRICULUM,
        'נטען הגאנט "גאנט הבדיקה"',
        CURRICULUM_PARAMS,
        CURRICULUM_HINTS,
    ),
    readTool(
        "list_weeks",
        "שבועות בגאנט",
        "מחזיר את שבועות הגאנט: מספר, תאריכים, הערה וסגירת שבת (weekendDuty).",
        { items: FIXTURE_WEEKS, total: FIXTURE_WEEKS.length, offset: 0 },
        "נמצאו 1 שבועות",
        CURRICULUM_PARAMS,
        weekHints(true),
    ),
    readTool(
        "get_curriculum_execution",
        "תכנון מול ביצוע",
        'מחזיר את פער התכנון מול הביצוע: לכל מודול, כמה שעות תוכננו וכמה בפועל בלו"ז.',
        FIXTURE_EXECUTION,
        "נטען מצב ביצוע ל-2 מודולים",
        CURRICULUM_PARAMS,
    ),
    unreachableWriteTool(
        "create_event",
        "יצירת אירוע",
        'יוצר אירוע חדש בלו"ז. fake=true יוצר מופע פיקטיבי: מוצג לחניכים ' +
            "כאירוע רגיל אך אינו מקושר להייב — רק צבע והערה. למילוי טווח ימים " +
            "קרא לכלי פעם אחת לכל יום.",
        AiToolDanger.Caution,
        {
            type: "object",
            properties: {
                name: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
                type: { type: "string", enum: Object.values(EventType) },
                courses: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
                fake: { type: "boolean" },
                color: { type: "string" },
            },
            required: ["name", "startTime", "endTime"],
            additionalProperties: false,
        },
    ),
    unreachableWriteTool(
        "update_event",
        "עדכון אירוע",
        "מעדכן אירוע קיים. יש להעביר רק את השדות שמשתנים.",
        AiToolDanger.Caution,
        {
            type: "object",
            properties: {
                id: { type: "string" },
                name: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
            },
            required: ["id"],
            additionalProperties: false,
        },
    ),
    unreachableWriteTool(
        "delete_event",
        "מחיקת אירוע",
        'מוחק (מארכב) אירוע מהלו"ז.',
        AiToolDanger.Destructive,
        {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
    ),
];

const FIXTURE_BY_NAME = new Map(FIXTURE_TOOLS.map((tool) => [tool.name, tool]));

/**
 * The tool surface a run offers: every production tool, by its production
 * name, description and schema, so tool choice is as hard as in real chat.
 *
 * - A tool the fixture models answers from the fixture.
 * - Any other read answers "no data here" rather than touching real data.
 * - Every write can only be proposed, never run.
 * - Prompt tools (ask_user) are kept as they are.
 *
 * Fixture tools with no production twin (tests mock the registry away) are
 * appended so the suite still runs.
 */
export function benchmarkTools(production: Array<AiTool<any>>): Array<AiTool<any>> {
    const names = new Set(production.map((tool) => tool.name));
    const standIns = production.map((tool): AiTool<any> => {
        const fixture = FIXTURE_BY_NAME.get(tool.name);
        if (tool.kind === AiToolKind.Prompt) return tool;
        if (tool.kind === AiToolKind.Write) {
            return {
                ...unreachableWriteTool(
                    tool.name, tool.title, tool.description, tool.danger, tool.parameters,
                ),
            };
        }
        return {
            ...tool,
            recovery: undefined,
            execute: fixture?.execute ?? (async () => ({
                data: { items: [], total: 0, offset: 0 },
                summary: "אין נתונים",
            })),
        };
    });
    return [...standIns, ...FIXTURE_TOOLS.filter((tool) => !names.has(tool.name))];
}
