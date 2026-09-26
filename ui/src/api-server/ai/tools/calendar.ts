/**
 * Calendar tools — the schedule half of the assistant (MongoDB).
 *
 * Every write goes through `DbEvent`, so event history, the WebSocket
 * broadcast and Hive lesson sync all happen exactly as they do for a UI edit.
 */

import {
    aiOrigin,
    changedFieldsImpact,
    escapeRegex,
    formatRange,
    ISO_DATE,
    NO_PARAMS,
    ROOM_SOURCE_PARAM,
    PAGE_PARAMS,
    PageArgs,
    pageSummary,
    paginate,
    parseDate,
} from "@/api-server/ai/tools/common";
import { AiTool } from "@/api-server/ai/tools/types";
import { DbEvent } from "@/api-server/db-event";
import { DbEventHistory } from "@/api-server/db-event-history";
import { DbIterations } from "@/api-server/db-iterations";
import { DbRooms } from "@/api-server/db-rooms";
import { resolveIterationDb } from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { ResolvableRoom } from "@/api-shared/types/room";
import { MAX_EVENT_RANGE_DAYS, MILLISECONDS_IN_A_DAY } from "@/settings";

/**
 * Trimmed view of an event — the full document is far too large to re-send,
 * and a narrow projection means a schema change on the document cannot
 * silently widen what the assistant sees.
 *
 * Exported so the benchmark fixture answers with exactly this shape rather
 * than an approximation of it.
 */
export type AiEventSummary = ReturnType<typeof summarizeEvent>;

function summarizeEvent(event: DbEventDocument) {
    return {
        id: event.id,
        name: event.name,
        type: event.type,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        rooms: event.rooms,
        courses: event.courses,
        instructors: event.instructors,
        locked: event.locked,
        // Without these the model cannot tell a student-invisible event from
        // a visible one, nor find the placeholders it created earlier.
        hidden: event.hidden,
        fake: event.fake ?? false,
        color: event.color ?? null,
        notes: event.notes,
    };
}

/**
 * Hive linkage a fake event must never carry: a placeholder wired to a real
 * subject or lesson would open a real Hive queue for students.
 */
const HIVE_FIELDS = ["subject", "hiveModule", "hiveLesson", "hiveQueues"];

const ROOMS_PARAM = {
    type: "array",
    description:
        "חדרי האירוע. כל חדר הוא אובייקט עם מזהה ומקור. " +
        "קח את המזהים מ-list_rooms.",
    items: {
        type: "object",
        properties: {
            id: { type: ["string", "number"] },
            source: ROOM_SOURCE_PARAM,
        },
        required: ["id", "source"],
        additionalProperties: false,
    },
};

const COURSES_PARAM = {
    type: "array",
    items: { type: "string" },
    description:
        "מזהי הקורסים (מחלקות) שרואים את האירוע. קח אותם מ-list_courses או מאירוע קיים.",
};

const EVENT_ID_PARAM = { type: "string", description: "מזהה האירוע" };

export const listIterationsTool: AiTool<Record<string, never>> = {
    name: "list_iterations",
    title: "רשימת מחזורים",
    danger: AiToolDanger.Safe,
    description:
        "מחזיר את כל המחזורים (iterations) הקיימים, כולל המחזור הנוכחי. " +
        "השתמש בזה כדי לזהות על איזה מחזור המשתמש מדבר.",
    kind: AiToolKind.Read,
    parameters: NO_PARAMS,

    async execute() {
        const iterations = await DbIterations.list();
        return {
            data: iterations.map((iteration) => ({
                id: iteration.id,
                label: iteration.label,
                isCurrent: iteration.isCurrent,
                curriculumId: iteration.ganttCurriculumId,
            })),
            summary: `נמצאו ${iterations.length} מחזורים`,
        };
    },
};

export const listRoomsTool: AiTool<PageArgs> = {
    name: "list_rooms",
    title: "רשימת חדרים",
    danger: AiToolDanger.Safe,
    description:
        "מחזיר את החדרים שהוגדרו בבלוז במחזור הנוכחי, עם המזהה והשם שלהם.",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { ...PAGE_PARAMS },
        additionalProperties: false,
    },

    async execute(args, context) {
        const rooms = await DbRooms.get(undefined, await context.readController());
        const page = paginate(rooms, args);
        return { data: page, summary: pageSummary(page, "חדרים") };
    },
};

type ListEventsArgs = {
    from: string;
    to: string;
    nameContains?: string;
    hidden?: boolean;
    fake?: boolean;
} & PageArgs;

export const listEventsTool: AiTool<ListEventsArgs> = {
    name: "list_events",
    title: 'אירועי הלו"ז',
    danger: AiToolDanger.Safe,
    nextSteps: [
        "לפני שינוי או מחיקה — ודא מול הרשימה הזו שהאירוע הוא הנכון.",
        "אם יותר מאירוע אחד מתאים לבקשה, שאל את המשתמש עם ask_user באיזה מדובר.",
    ],
    description:
        'מחזיר את אירועי הלו"ז שחופפים לטווח תאריכים. הטווח חייב להיות ' +
        "סביר (עד כמה שבועות). אפשר לסנן לפי מחרוזת בשם האירוע, לפי " +
        "אירועים מוסתרים (hidden) ולפי אירועים פיקטיביים (fake).",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: {
            from: ISO_DATE,
            to: ISO_DATE,
            nameContains: {
                type: "string",
                description: "סינון אופציונלי לפי טקסט בשם האירוע",
            },
            hidden: {
                type: "boolean",
                description:
                    "true — רק אירועים מוסתרים מהחניכים; false — רק גלויים. השמט לכולם.",
            },
            fake: {
                type: "boolean",
                description:
                    "true — רק אירועים פיקטיביים; false — רק אמיתיים. השמט לכולם.",
            },
            ...PAGE_PARAMS,
        },
        required: ["from", "to"],
        additionalProperties: false,
    },

    async execute(args, context) {
        const filter: Record<string, unknown> = {};
        if (args.nameContains) {
            filter.name = {
                $regex: escapeRegex(args.nameContains),
                $options: "i",
            };
        }
        if (args.hidden !== undefined) filter.hidden = args.hidden;
        // Legacy events have no `fake` key at all, so "not fake" is `$ne`.
        if (args.fake !== undefined) {
            filter.fake = args.fake ? true : { $ne: true };
        }

        const events = await DbEvent.getInRange(
            parseDate(args.from, "from"),
            parseDate(args.to, "to"),
            undefined,
            Object.keys(filter).length ? filter : undefined,
            await context.readController(),
        );
        const page = paginate(events.map(summarizeEvent), args);
        return { data: page, summary: pageSummary(page, "אירועים בטווח") };
    },
};

export const getEventTool: AiTool<{ id: string }> = {
    name: "get_event",
    title: "פרטי אירוע",
    danger: AiToolDanger.Safe,
    description:
        "מחזיר את כל הפרטים של אירוע אחד, כולל שדות שלא מופיעים ב-list_events " +
        "(מרצים, תגיות, קישורי הייב, מקור הגזירה מהגאנט).",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { id: EVENT_ID_PARAM },
        required: ["id"],
        additionalProperties: false,
    },

    async execute(args, context) {
        const event = await DbEvent.get(
            args.id,
            { projection: { _id: 0 } },
            await context.readController(),
        );
        if (!event) throw new ClientApiError(`אירוע ${args.id} לא נמצא`);
        return { data: event, summary: `נטען האירוע "${event.name}"` };
    },
};

export const getEventHistoryTool: AiTool<{ id: string } & PageArgs> = {
    name: "get_event_history",
    title: "היסטוריית אירוע",
    danger: AiToolDanger.Safe,
    description:
        "מחזיר את היסטוריית השינויים של אירוע, מהחדש לישן: מי שינה, מתי ומה.",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { id: EVENT_ID_PARAM, ...PAGE_PARAMS },
        required: ["id"],
        additionalProperties: false,
    },

    async execute(args, context) {
        const entries = await DbEventHistory.forEvent(
            args.id,
            await context.readController(),
        );
        const page = paginate(
            entries.map((entry) => ({
                action: entry.action,
                initiator: entry.initiator,
                actorName: entry.actorName,
                changedAt: new Date(entry.changedAt).toISOString(),
                changes: entry.changes,
            })),
            args,
        );
        return { data: page, summary: pageSummary(page, "שינויים") };
    },
};

type CompareEventsArgs = {
    iterationA?: string;
    iterationB?: string;
    from: string;
    to: string;
};

export const compareEventsTool: AiTool<CompareEventsArgs> = {
    name: "compare_events",
    title: "השוואת מחזורים",
    danger: AiToolDanger.Safe,
    description:
        "משווה את אירועי שני מחזורים באותו טווח תאריכים ומחזיר את שתי הרשימות. " +
        "השמט מחזור כדי להשתמש במחזור הנוכחי.",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: {
            iterationA: { type: "string", description: "מזהה המחזור הראשון" },
            iterationB: { type: "string", description: "מזהה המחזור השני" },
            from: ISO_DATE,
            to: ISO_DATE,
        },
        required: ["from", "to"],
        additionalProperties: false,
    },

    async execute(args) {
        const from = parseDate(args.from, "from");
        const to = parseDate(args.to, "to");
        // Same ceiling as /api/event/compare: two full scans per call.
        const days = (to.getTime() - from.getTime()) / MILLISECONDS_IN_A_DAY;
        if (days < 0 || days > MAX_EVENT_RANGE_DAYS) {
            throw new ClientApiError(
                `טווח התאריכים חייב להיות בין 0 ל-${MAX_EVENT_RANGE_DAYS} ימים`,
            );
        }
        const [controllerA, controllerB] = await Promise.all([
            resolveIterationDb(args.iterationA),
            resolveIterationDb(args.iterationB),
        ]);
        const [a, b] = await Promise.all([
            DbEvent.getInRange(from, to, undefined, undefined, controllerA),
            DbEvent.getInRange(from, to, undefined, undefined, controllerB),
        ]);
        return {
            data: { a: a.map(summarizeEvent), b: b.map(summarizeEvent) },
            summary: `הושוו ${a.length} מול ${b.length} אירועים`,
        };
    },
};

type CreateEventArgs = {
    name: string;
    startTime: string;
    endTime: string;
    type?: EventType;
    rooms?: Array<ResolvableRoom>;
    courses?: Array<string>;
    notes?: string;
    fake?: boolean;
    color?: string;
};

export const createEventTool: AiTool<CreateEventArgs> = {
    name: "create_event",
    title: "יצירת אירוע",
    danger: AiToolDanger.Caution,
    description:
        'יוצר אירוע חדש בלו"ז של המחזור. השתמש בזה רק אחרי שווידאת מול ' +
        "list_events שאין התנגשות, ואחרי שהמשתמש אישר את הפרטים. " +
        "fake=true יוצר מופע פיקטיבי: מוצג לחניכים כאירוע רגיל אך אינו מקושר " +
        "להייב — רק צבע והערה. למילוי טווח ימים קרא לכלי פעם אחת לכל יום.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: {
            name: { type: "string", description: "שם האירוע" },
            startTime: ISO_DATE,
            endTime: ISO_DATE,
            type: {
                type: "string",
                enum: Object.values(EventType),
                description: "סוג האירוע. ברירת המחדל היא אחר",
            },
            rooms: ROOMS_PARAM,
            courses: COURSES_PARAM,
            notes: { type: "string", description: "הערה חופשית לאירוע" },
            fake: {
                type: "boolean",
                description: "מופע פיקטיבי (placeholder). ברירת מחדל: false",
            },
            color: {
                type: "string",
                description: "צבע ידני בפורמט hex, למשל #4caf50",
            },
        },
        required: ["name", "startTime", "endTime"],
        additionalProperties: false,
    },

    describe(args) {
        const kind = args.fake ? "אירוע פיקטיבי" : "אירוע";
        return `יצירת ${kind} "${args.name}" ב-${formatRange(args.startTime, args.endTime)}`;
    },

    impact(args) {
        return [
            `אירוע חדש בשם "${args.name}" יתווסף ללו"ז.`,
            `מועד: ${formatRange(args.startTime, args.endTime)}.`,
            ...(args.rooms?.length
                ? [`ישובץ ל-${args.rooms.length} חדרים.`]
                : ["ללא שיבוץ חדר."]),
            args.fake
                ? "מופע פיקטיבי: יוצג לחניכים כאירוע רגיל, ללא קישור להייב."
                : "האירוע יסונכרן להייב ויופיע אצל כל מי שרואה את המחזור.",
        ];
    },

    async execute(args, context) {
        if (args.fake) {
            const hiveKeys = HIVE_FIELDS.filter((key) => key in args);
            if (hiveKeys.length) {
                throw new ClientApiError(
                    `אירוע פיקטיבי לא יכול לכלול שדות הייב: ${hiveKeys.join(", ")}`,
                );
            }
        }

        // Bluz events carry a client-generated UUID; the store rejects a
        // document without one. Every field DbEventDocument requires is set
        // directly here — no `as unknown as` — so a future field added to the
        // schema fails typecheck instead of silently defaulting to undefined.
        const event: DbEventDocument = {
            id: crypto.randomUUID(),
            name: args.name,
            subject: 0,
            hiveModule: 0,
            startTime: parseDate(args.startTime, "startTime"),
            endTime: parseDate(args.endTime, "endTime"),
            type: args.type ?? EventType.OTHER,
            courses: args.courses ?? [],
            rooms: args.rooms ?? [],
            instructors: [],
            tags: [],
            notes: args.notes ?? "",
            locked: false,
            hidden: false,
            required: false,
            personalTalk: false,
            splitAcrossBreaks: false,
            ...(args.fake ? { fake: true } : {}),
            ...(args.color ? { color: args.color } : {}),
        };

        const created = await DbEvent.create(
            event,
            undefined,
            await context.writeController(),
            context.iterationId,
            aiOrigin(context),
        );
        return {
            data: summarizeEvent(created),
            summary: `נוצר אירוע "${created.name}"`,
        };
    },
};

type UpdateEventArgs = {
    id: string;
    name?: string;
    startTime?: string;
    endTime?: string;
    type?: EventType;
    rooms?: Array<ResolvableRoom>;
    courses?: Array<string>;
    notes?: string;
    color?: string;
    hidden?: boolean;
};

const UPDATE_EVENT_LABELS: Record<string, string> = {
    name: "שם האירוע ישונה",
    notes: "ההערות יוחלפו",
    rooms: "שיבוץ החדרים יוחלף",
    courses: "הקורסים שרואים את האירוע יוחלפו",
    startTime: "שעת ההתחלה תשונה",
    endTime: "שעת הסיום תשונה",
    type: "סוג האירוע ישונה",
    color: "צבע האירוע ישונה",
    hidden: "הנראות לחניכים תשונה",
};

export const updateEventTool: AiTool<UpdateEventArgs> = {
    name: "update_event",
    title: "עדכון אירוע",
    danger: AiToolDanger.Caution,
    description:
        "מעדכן אירוע קיים. יש להעביר רק את השדות שמשתנים; שאר השדות נשמרים. " +
        "חובה להביא את האירוע קודם עם list_events כדי לקבל את המזהה שלו.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: {
            id: EVENT_ID_PARAM,
            name: { type: "string" },
            startTime: ISO_DATE,
            endTime: ISO_DATE,
            type: { type: "string", enum: Object.values(EventType) },
            rooms: ROOMS_PARAM,
            courses: COURSES_PARAM,
            notes: { type: "string" },
            color: { type: "string" },
            hidden: { type: "boolean", description: "הסתרה מהחניכים" },
        },
        required: ["id"],
        additionalProperties: false,
    },

    describe(args) {
        return `עדכון אירוע ${args.id}`;
    },

    impact(args) {
        return [
            ...changedFieldsImpact(args, UPDATE_EVENT_LABELS),
            "השינוי יירשם בהיסטוריית האירוע על שם העוזר וניתן לשחזור ממנה.",
        ];
    },

    async execute(args, context) {
        const controller = await context.writeController();
        const existing = await DbEvent.get(args.id, undefined, controller);
        if (!existing) {
            throw new ClientApiError(`אירוע ${args.id} לא נמצא`);
        }

        // A partial patch on top of the stored document: the model is told to
        // send only what changes, and everything else must survive untouched.
        const updated: DbEventDocument = {
            ...existing,
            ...(args.name !== undefined ? { name: args.name } : {}),
            ...(args.notes !== undefined ? { notes: args.notes } : {}),
            ...(args.rooms !== undefined ? { rooms: args.rooms } : {}),
            ...(args.courses !== undefined ? { courses: args.courses } : {}),
            ...(args.type !== undefined ? { type: args.type } : {}),
            ...(args.color !== undefined ? { color: args.color } : {}),
            ...(args.hidden !== undefined ? { hidden: args.hidden } : {}),
            ...(args.startTime !== undefined
                ? { startTime: parseDate(args.startTime, "startTime") }
                : {}),
            ...(args.endTime !== undefined
                ? { endTime: parseDate(args.endTime, "endTime") }
                : {}),
        };

        const result = await DbEvent.set(
            updated,
            undefined,
            controller,
            context.iterationId,
            aiOrigin(context),
        );
        return {
            data: summarizeEvent(result),
            summary: `עודכן אירוע "${result.name}"`,
        };
    },
};

type DeleteEventArgs = { id: string };

export const deleteEventTool: AiTool<DeleteEventArgs> = {
    name: "delete_event",
    title: "מחיקת אירוע",
    danger: AiToolDanger.Destructive,
    description:
        'מוחק (מארכב) אירוע מהלו"ז. פעולה זו הפיכה רק דרך היסטוריית האירועים, ' +
        "אז ודא מול המשתמש שזה האירוע הנכון.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: { id: EVENT_ID_PARAM },
        required: ["id"],
        additionalProperties: false,
    },

    describe(args) {
        return `מחיקת אירוע ${args.id}`;
    },

    impact() {
        return [
            'האירוע יוסר מהלו"ז של כל מי שרואה את המחזור.',
            "השחזור אפשרי רק דרך היסטוריית האירועים.",
            "אם האירוע מסונכרן להייב — הוא ייעלם גם שם.",
        ];
    },

    async execute(args, context) {
        const controller = await context.writeController();
        const existing = await DbEvent.get(args.id, undefined, controller);
        if (!existing) {
            throw new ClientApiError(`אירוע ${args.id} לא נמצא`);
        }

        await DbEvent.del(
            args.id,
            undefined,
            controller,
            context.iterationId,
            aiOrigin(context),
        );
        return {
            data: { id: args.id, deleted: true },
            summary: `נמחק אירוע "${existing.name}"`,
        };
    },
};

export const CALENDAR_TOOLS = [
    listIterationsTool,
    listRoomsTool,
    listEventsTool,
    getEventTool,
    getEventHistoryTool,
    compareEventsTool,
    createEventTool,
    updateEventTool,
    deleteEventTool,
] as Array<AiTool<any>>;
