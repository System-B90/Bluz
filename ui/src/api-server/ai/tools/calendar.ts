/**
 * Calendar tools — the schedule half of the assistant (MongoDB).
 *
 * Every write goes through `DbEvent`, so event history, the WebSocket
 * broadcast and Hive lesson sync all happen exactly as they do for a UI edit.
 */

import { AiTool, AiToolContext } from "@/api-server/ai/tools/types";
import { DbEvent } from "@/api-server/db-event";
import { EventWriteOrigin } from "@/api-server/db-event-history";
import { DbIterations } from "@/api-server/db-iterations";
import { DbRooms } from "@/api-server/db-rooms";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolKind } from "@/api-shared/types/ai";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { ResolvableRoom, RoomSource } from "@/api-shared/types/room";

/**
 * Marks every assistant write in the event history, so a curious operator can
 * always tell an AI edit from a human one after the fact.
 */
function aiOrigin(context: AiToolContext): EventWriteOrigin {
    return {
        initiator: EventChangeInitiator.AiAssistant,
        actor: context.actor,
    };
}

/**
 * Escapes text before it reaches Mongo's `$regex`. The model relays whatever
 * the user typed, so an unescaped value both widens the search silently (`.`,
 * `|`) and exposes the server to catastrophic backtracking (`(a+)+b`).
 */
function escapeRegex(value: string): string {
    return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

/** Rejects a date the model invented in the wrong format. */
function parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ClientApiError(`ערך תאריך לא תקין בשדה ${field}: ${value}`);
    }
    return date;
}

/** Trimmed view of an event — the full document is far too large to re-send. */
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
        notes: event.notes,
    };
}

const ISO_DATE = {
    type: "string",
    description: "תאריך ושעה בפורמט ISO 8601, למשל 2026-03-01T09:00:00Z",
};

const ROOMS_PARAM = {
    type: "array",
    description:
        "חדרי האירוע. כל חדר הוא אובייקט עם מזהה ומקור — hive לחדרי הייב, " +
        "custom לחדרים שהוגדרו בבלוז. קח את המזהים מ-list_rooms.",
    items: {
        type: "object",
        properties: {
            id: { type: ["string", "number"] },
            source: { type: "string", enum: Object.values(RoomSource) },
        },
        required: ["id", "source"],
        additionalProperties: false,
    },
};

export const listIterationsTool: AiTool<Record<string, never>> = {
    name: "list_iterations",
    description:
        "מחזיר את כל המחזורים (iterations) הקיימים, כולל המחזור הנוכחי. " +
        "השתמש בזה כדי לזהות על איזה מחזור המשתמש מדבר.",
    kind: AiToolKind.Read,
    parameters: { type: "object", properties: {}, additionalProperties: false },

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

export const listRoomsTool: AiTool<Record<string, never>> = {
    name: "list_rooms",
    description:
        "מחזיר את כל החדרים המוגדרים במחזור הנוכחי, עם המזהה והשם שלהם.",
    kind: AiToolKind.Read,
    parameters: { type: "object", properties: {}, additionalProperties: false },

    async execute(_args, context) {
        const rooms = await DbRooms.get(undefined, await context.readController());
        return {
            data: rooms,
            summary: `נמצאו ${rooms.length} חדרים`,
        };
    },
};

type ListEventsArgs = { from: string; to: string; nameContains?: string };

export const listEventsTool: AiTool<ListEventsArgs> = {
    name: "list_events",
    description:
        'מחזיר את אירועי הלו"ז שחופפים לטווח תאריכים. הטווח חייב להיות ' +
        "סביר (עד כמה שבועות). אפשר לסנן לפי מחרוזת בשם האירוע.",
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
        },
        required: ["from", "to"],
        additionalProperties: false,
    },

    async execute(args, context) {
        const events = await DbEvent.getInRange(
            parseDate(args.from, "from"),
            parseDate(args.to, "to"),
            undefined,
            args.nameContains
                ? {
                    name: {
                        $regex: escapeRegex(args.nameContains),
                        $options: "i",
                    },
                }
                : undefined,
            await context.readController(),
        );
        return {
            data: events.map(summarizeEvent),
            summary: `נמצאו ${events.length} אירועים בטווח`,
        };
    },
};

type CreateEventArgs = {
    name: string;
    startTime: string;
    endTime: string;
    type?: EventType;
    rooms?: Array<ResolvableRoom>;
    notes?: string;
};

export const createEventTool: AiTool<CreateEventArgs> = {
    name: "create_event",
    description:
        'יוצר אירוע חדש בלו"ז של המחזור. השתמש בזה רק אחרי שווידאת מול ' +
        "list_events שאין התנגשות, ואחרי שהמשתמש אישר את הפרטים.",
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
            notes: { type: "string" },
        },
        required: ["name", "startTime", "endTime"],
        additionalProperties: false,
    },

    describe(args) {
        return `יצירת אירוע "${args.name}" בין ${args.startTime} ל-${args.endTime}`;
    },

    async execute(args, context) {
        // Bluz events carry a client-generated UUID; the store rejects a
        // document without one.
        const event = {
            id: crypto.randomUUID(),
            name: args.name,
            subject: 0,
            hiveModule: 0,
            startTime: parseDate(args.startTime, "startTime"),
            endTime: parseDate(args.endTime, "endTime"),
            type: args.type ?? EventType.OTHER,
            courses: [],
            rooms: args.rooms ?? [],
            instructors: [],
            tags: [],
            notes: args.notes ?? "",
            locked: false,
            hidden: false,
            required: false,
            personalTalk: false,
            splitAcrossBreaks: false,
        } as unknown as DbEventDocument;

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
    rooms?: Array<ResolvableRoom>;
    notes?: string;
};

export const updateEventTool: AiTool<UpdateEventArgs> = {
    name: "update_event",
    description:
        "מעדכן אירוע קיים. יש להעביר רק את השדות שמשתנים; שאר השדות נשמרים. " +
        "חובה להביא את האירוע קודם עם list_events כדי לקבל את המזהה שלו.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: {
            id: { type: "string", description: "מזהה האירוע" },
            name: { type: "string" },
            startTime: ISO_DATE,
            endTime: ISO_DATE,
            rooms: ROOMS_PARAM,
            notes: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
    },

    describe(args) {
        const fields = Object.keys(args).filter((key) => key !== "id");
        return `עדכון אירוע ${args.id} (${fields.join(", ")})`;
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
    description:
        'מוחק (מארכב) אירוע מהלו"ז. פעולה זו הפיכה רק דרך היסטוריית האירועים, ' +
        "אז ודא מול המשתמש שזה האירוע הנכון.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: { id: { type: "string", description: "מזהה האירוע" } },
        required: ["id"],
        additionalProperties: false,
    },

    describe(args) {
        return `מחיקת אירוע ${args.id}`;
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
    createEventTool,
    updateEventTool,
    deleteEventTool,
] as Array<AiTool<any>>;
