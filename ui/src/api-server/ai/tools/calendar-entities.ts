/**
 * Calendar entity tools — everything on the schedule side that is not an
 * event: courses, outsiders, custom rooms, room reservations, shared drafts,
 * snapshots and the read-only settings the cut rules depend on.
 *
 * Each wraps the same `Db*` controller its REST route calls, through the
 * iteration-scoped controllers in the tool context, so a write here is bound
 * by exactly the allow-lists and broadcasts a UI edit is.
 */

import { ROOM_SOURCE_PARAM } from "@/api-server/ai/tools/calendar";
import {
    changedFieldsImpact,
    formatRange,
    ISO_DATE,
    PAGE_PARAMS,
    PageArgs,
    pageSummary,
    paginate,
    parseDate,
    pickDefined,
    requireText,
} from "@/api-server/ai/tools/common";
import { AiTool } from "@/api-server/ai/tools/types";
import { DbCalendarDraft } from "@/api-server/db-calendar-draft";
import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import { DbCourses } from "@/api-server/db-courses";
import { DbEvent } from "@/api-server/db-event";
import { DbOutsiders } from "@/api-server/db-outsiders";
import { DbReservations } from "@/api-server/db-reservations";
import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { DbRooms } from "@/api-server/db-rooms";
import { DbSettings } from "@/api-server/db-settings";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { Course } from "@/api-shared/types/course";
import { DbEventDocument } from "@/api-shared/types/event";
import { Outsider } from "@/api-shared/types/outsider";
import { ReserverType } from "@/api-shared/types/reservation";
import { CustomRoom, RoomExtendedInfo, RoomSource } from "@/api-shared/types/room";
import { MEAL_TIMES_SETTING_KEY } from "@/api-shared/types/settings/meal";
import { PRAYER_TIMES_SETTING_KEY } from "@/api-shared/types/settings/prayer";
import { SCHEDULE_SETTINGS_KEY } from "@/api-shared/types/settings/schedule";
import { SettingName } from "@/api-shared/types/settings/settings";

// ---------------------------------------------------------------------------
// Directory entities: courses, outsiders, custom rooms
// ---------------------------------------------------------------------------

/** The shape every directory controller (`DbCourses`, `DbOutsiders`, …) shares. */
type DirectoryStore<T> = {
    get: (options: undefined, controller: DatabaseController) => Promise<Array<T>>;
    create: (item: T, controller: DatabaseController) => Promise<T>;
    set: (item: T, options: undefined, controller: DatabaseController) => Promise<void>;
    del: (id: string, controller: DatabaseController) => Promise<void>;
};
type DirectorySpec<T extends { id: string; name: string }> = {
    /** Wire-name stem: `course` → list_courses, create_course, … */
    entity: string;
    plural: string;
    noun: string;
    nounPlural: string;
    store: DirectoryStore<T>;
    idPrefix: string;
    /** JSON-schema properties for the editable fields. */
    fields: Record<string, Record<string, unknown>>;
    required: Array<string>;
    /** Hebrew bullet per field, for the update approval card. */
    labels: Record<string, string>;
    /** Fills the fields the store requires but the model may omit. */
    defaults: (args: Record<string, unknown>) => Omit<T, "id">;
    deleteImpact: Array<string>;
    /** Set when another tool already lists this entity. */
    omitList?: boolean;
};

/**
 * Builds list/create/update/delete for one directory entity.
 *
 * The three directories differ only in their fields, so one factory keeps the
 * approval wording, pagination and partial-update rule identical across them
 * instead of drifting in three hand-copied files.
 */
function directoryTools<T extends { id: string; name: string }>(
    spec: DirectorySpec<T>,
): Array<AiTool<any>> {
    const editable = Object.keys(spec.fields);
    const idParam = { type: "string", description: `מזהה ה${spec.noun}` };

    async function findExisting(id: string, controller: DatabaseController) {
        const all = await spec.store.get(undefined, controller);
        const found = all.find((item) => item.id === id);
        if (!found) throw new ClientApiError(`${spec.noun} ${id} לא נמצא`);
        return found;
    }

    const list: AiTool<PageArgs> = {
        name: `list_${spec.plural}`,
        title: `רשימת ${spec.nounPlural}`,
        danger: AiToolDanger.Safe,
        kind: AiToolKind.Read,
        description: `מחזיר את ה${spec.nounPlural} המוגדרים במחזור, עם המזהים שלהם.`,
        parameters: {
            type: "object",
            properties: { ...PAGE_PARAMS },
            additionalProperties: false,
        },
        async execute(args, context) {
            const items = await spec.store.get(
                undefined,
                await context.readController(),
            );
            const page = paginate(items, args);
            return { data: page, summary: pageSummary(page, spec.nounPlural) };
        },
    };

    const create: AiTool<Record<string, unknown>> = {
        name: `create_${spec.entity}`,
        title: `יצירת ${spec.noun}`,
        danger: AiToolDanger.Caution,
        kind: AiToolKind.Write,
        description: `יוצר ${spec.noun} חדש במחזור הנוכחי.`,
        parameters: {
            type: "object",
            properties: spec.fields,
            required: spec.required,
            additionalProperties: false,
        },
        describe: (args) => `יצירת ${spec.noun} "${String(args.name)}"`,
        impact: (args) => [
            `${spec.noun} חדש בשם "${String(args.name)}" יתווסף למחזור.`,
        ],
        async execute(args, context) {
            for (const field of spec.required) requireText(args[field], field);
            const item = {
                ...spec.defaults(args),
                ...pickDefined(args, editable),
                id: `${spec.idPrefix}-${crypto.randomUUID()}`,
            } as T;
            const created = await spec.store.create(
                item,
                await context.writeController(),
            );
            return { data: created, summary: `נוצר ${spec.noun} "${created.name}"` };
        },
    };

    const update: AiTool<{ id: string } & Record<string, unknown>> = {
        name: `update_${spec.entity}`,
        title: `עדכון ${spec.noun}`,
        danger: AiToolDanger.Caution,
        kind: AiToolKind.Write,
        description: `מעדכן ${spec.noun} קיים. העבר רק את השדות שמשתנים.`,
        parameters: {
            type: "object",
            properties: { id: idParam, ...spec.fields },
            required: ["id"],
            additionalProperties: false,
        },
        describe: (args) => `עדכון ${spec.noun} ${args.id}`,
        impact: (args) => changedFieldsImpact(args, spec.labels),
        async execute(args, context) {
            const controller = await context.writeController();
            const existing = await findExisting(args.id, controller);
            const updated = { ...existing, ...pickDefined(args, editable) };
            await spec.store.set(updated, undefined, controller);
            return { data: updated, summary: `עודכן ${spec.noun} "${updated.name}"` };
        },
    };

    const remove: AiTool<{ id: string }> = {
        name: `delete_${spec.entity}`,
        title: `מחיקת ${spec.noun}`,
        danger: AiToolDanger.Destructive,
        kind: AiToolKind.Write,
        description: `מוחק ${spec.noun} לצמיתות. ודא מול המשתמש שזה הנכון.`,
        parameters: {
            type: "object",
            properties: { id: idParam },
            required: ["id"],
            additionalProperties: false,
        },
        describe: (args) => `מחיקת ${spec.noun} ${args.id}`,
        impact: () => [...spec.deleteImpact, "המחיקה סופית ואין לה היסטוריה לשחזור."],
        async execute(args, context) {
            const controller = await context.writeController();
            const existing = await findExisting(args.id, controller);
            await spec.store.del(args.id, controller);
            return {
                data: { id: args.id, deleted: true },
                summary: `נמחק ${spec.noun} "${existing.name}"`,
            };
        },
    };

    return spec.omitList ? [create, update, remove] : [list, create, update, remove];
}

const NAME_FIELD = { type: "string", description: "שם" };

export const COURSE_TOOLS = directoryTools<Course>({
    entity: "course",
    plural: "courses",
    noun: "קורס",
    nounPlural: "קורסים",
    store: DbCourses as unknown as DirectoryStore<Course>,
    idPrefix: "course",
    fields: {
        name: NAME_FIELD,
        color: { type: "string", description: "צבע hex, למשל #1976d2" },
        parentId: { type: "string", description: "מזהה קורס האב, אם יש" },
        description: { type: "string" },
    },
    required: ["name"],
    labels: {
        name: "שם הקורס ישונה",
        color: "צבע הקורס ישונה",
        parentId: "קורס האב ישונה",
        description: "התיאור יוחלף",
    },
    defaults: () => ({ name: "", color: null }),
    deleteImpact: [
        "הקורס יוסר מהמחזור.",
        "אירועים שמשויכים אליו יישארו עם מזהה קורס שאינו קיים.",
    ],
});

export const OUTSIDER_TOOLS = directoryTools<Outsider>({
    entity: "outsider",
    plural: "outsiders",
    noun: "איש חוץ",
    nounPlural: "אנשי חוץ",
    store: DbOutsiders as unknown as DirectoryStore<Outsider>,
    idPrefix: "outsider",
    fields: {
        name: { type: "string", description: "שם מלא" },
        phone: { type: "string", description: "טלפון" },
        personalNumber: { type: "string", description: "מספר אישי (7 ספרות)" },
        idNumber: { type: "string", description: "ת.ז. (9 ספרות)" },
        releaseDate: { type: "string", description: "תאריך שחרור ISO" },
        comment: { type: "string", description: "הערה" },
    },
    required: ["name", "phone"],
    labels: {
        name: "השם ישונה",
        phone: "הטלפון ישונה",
        personalNumber: "המספר האישי ישונה",
        idNumber: "תעודת הזהות תשונה",
        releaseDate: "תאריך השחרור ישונה",
        comment: "ההערה תוחלף",
    },
    defaults: () => ({ name: "", phone: "" }),
    deleteImpact: ["איש החוץ יוסר מרשימת המרצים המומלצים ומהזמנות עתידיות."],
});

export const ROOM_TOOLS = directoryTools<CustomRoom>({
    entity: "room",
    plural: "rooms",
    noun: "חדר",
    nounPlural: "חדרים שהוגדרו בבלוז",
    store: DbRooms as unknown as DirectoryStore<CustomRoom>,
    idPrefix: "room",
    fields: {
        name: NAME_FIELD,
        description: { type: "string" },
    },
    required: ["name"],
    labels: { name: "שם החדר ישונה", description: "התיאור יוחלף" },
    // Only custom rooms live in Bluz; Hive rooms are read-only here.
    defaults: () => ({ name: "", source: RoomSource.Custom }),
    deleteImpact: ["אירועים ששובצו לחדר יישארו עם שיבוץ לחדר שאינו קיים."],
    // `list_rooms` in calendar.ts already lists these.
    omitList: true,
});

type RoomExtendedInfoArgs = { roomId: number | string; roomSource: RoomSource } & Partial<RoomExtendedInfo>;

export const setRoomExtendedInfoTool: AiTool<RoomExtendedInfoArgs> = {
    name: "set_room_extended_info",
    title: "עדכון מידע מורחב לחדר",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "מעדכן את המידע המורחב של חדר (בלוז או הייב): מספר עמדות, מקומות ישיבה, " +
        'נוחות להרצאה ופ"ע.',
    parameters: {
        type: "object",
        properties: {
            roomId: { type: ["string", "number"] },
            roomSource: ROOM_SOURCE_PARAM,
            workstationCount: { type: ["integer", "null"] },
            lectureSeatCount: { type: ["integer", "null"] },
            lectureComfortable: { type: "boolean" },
            peAyin: { type: "boolean" },
        },
        required: ["roomId", "roomSource"],
        additionalProperties: false,
    },
    describe: (args) => `עדכון מידע מורחב לחדר ${args.roomId}`,
    impact: (args) =>
        changedFieldsImpact(args, {
            workstationCount: "מספר העמדות ישונה",
            lectureSeatCount: "מספר המקומות להרצאה ישונה",
            lectureComfortable: "סימון נוחות להרצאה ישונה",
            peAyin: 'סימון פ"ע ישונה',
        }),
    async execute(args, context) {
        const { roomId, roomSource, ...rest } = args;
        const info: RoomExtendedInfo = {
            workstationCount: rest.workstationCount ?? null,
            lectureSeatCount: rest.lectureSeatCount ?? null,
            lectureComfortable: rest.lectureComfortable ?? false,
            peAyin: rest.peAyin ?? false,
        };
        await DbRoomExtendedInfo.upsert(
            roomId,
            roomSource,
            info,
            await context.writeController(),
        );
        return { data: { roomId, roomSource, ...info }, summary: "עודכן מידע החדר" };
    },
};

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

type ListReservationsArgs = {
    roomId?: number | string;
    roomSource?: RoomSource;
    from?: string;
    to?: string;
} & PageArgs;

export const listReservationsTool: AiTool<ListReservationsArgs> = {
    name: "list_reservations",
    title: "הזמנות חדרים",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר הזמנות חדרים, אופציונלית לחדר מסוים ולטווח זמן.",
    parameters: {
        type: "object",
        properties: {
            roomId: { type: ["string", "number"] },
            roomSource: ROOM_SOURCE_PARAM,
            from: ISO_DATE,
            to: ISO_DATE,
            ...PAGE_PARAMS,
        },
        additionalProperties: false,
    },
    async execute(args, context) {
        const reservations = await DbReservations.get(
            args.roomId,
            args.roomSource,
            args.from,
            args.to,
            await context.readController(),
        );
        const page = paginate(reservations, args);
        return { data: page, summary: pageSummary(page, "הזמנות") };
    },
};

type CreateReservationArgs = {
    roomId: number | string;
    roomSource: RoomSource;
    start: string;
    end: string;
    reserverType: ReserverType;
    reserverId: string;
    note?: string;
};

export const createReservationTool: AiTool<CreateReservationArgs> = {
    name: "create_reservation",
    title: "הזמנת חדר",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "מזמין חדר לטווח זמן על שם מדריך (מזהה הייב) או איש חוץ. נכשל אם החדר תפוס.",
    parameters: {
        type: "object",
        properties: {
            roomId: { type: ["string", "number"] },
            roomSource: ROOM_SOURCE_PARAM,
            start: ISO_DATE,
            end: ISO_DATE,
            reserverType: { type: "string", enum: ["instructor", "outsider"] },
            reserverId: { type: "string" },
            note: { type: "string" },
        },
        required: ["roomId", "roomSource", "start", "end", "reserverType", "reserverId"],
        additionalProperties: false,
    },
    describe: (args) =>
        `הזמנת חדר ${args.roomId} ל-${formatRange(args.start, args.end)}`,
    impact: (args) => [
        `החדר יסומן כתפוס ב-${formatRange(args.start, args.end)}.`,
        "הזמנה חופפת לאותו חדר תידחה.",
    ],
    async execute(args, context) {
        const reservation = await DbReservations.create(
            {
                roomId: args.roomId,
                roomSource: args.roomSource,
                start: parseDate(args.start, "start").toISOString(),
                end: parseDate(args.end, "end").toISOString(),
                reserverType: args.reserverType,
                reserverId: requireText(args.reserverId, "reserverId"),
                ...(args.note ? { note: args.note } : {}),
            },
            await context.writeController(),
        );
        return { data: reservation, summary: "החדר הוזמן" };
    },
};

export const deleteReservationTool: AiTool<{ id: string }> = {
    name: "delete_reservation",
    title: "ביטול הזמנת חדר",
    danger: AiToolDanger.Destructive,
    kind: AiToolKind.Write,
    description: "מבטל הזמנת חדר לפי המזהה (_id) שלה מ-list_reservations.",
    parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    describe: (args) => `ביטול הזמנה ${args.id}`,
    impact: () => ["ההזמנה תימחק והחדר ישוחרר בטווח שלה."],
    async execute(args, context) {
        await DbReservations.cancel(args.id, await context.writeController());
        return { data: { id: args.id, deleted: true }, summary: "ההזמנה בוטלה" };
    },
};

// ---------------------------------------------------------------------------
// Drafts and snapshots
// ---------------------------------------------------------------------------

/** Live events in a range, stripped of Mongo's `_id` before re-storing them. */
async function eventsInRange(
    from: string,
    to: string,
    controller: DatabaseController,
): Promise<Array<DbEventDocument>> {
    return await DbEvent.getInRange(
        parseDate(from, "from"),
        parseDate(to, "to"),
        { projection: { _id: 0 } },
        undefined,
        controller,
    );
}

const LABEL_PARAM = { type: "string", description: "שם קצר ומזהה" };

export const listCalendarDraftsTool: AiTool<PageArgs> = {
    name: "list_calendar_drafts",
    title: "טיוטות לו\"ז",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את הטיוטות המשותפות של הלו\"ז במחזור, מהמעודכנת ביותר.",
    parameters: { type: "object", properties: { ...PAGE_PARAMS }, additionalProperties: false },
    async execute(args, context) {
        const drafts = await DbCalendarDraft.list(
            await context.readController(),
            context.iterationId,
        );
        const page = paginate(drafts, args);
        return { data: page, summary: pageSummary(page, "טיוטות") };
    },
};

type CreateDraftArgs = { label: string; from?: string; to?: string };

export const createCalendarDraftTool: AiTool<CreateDraftArgs> = {
    name: "create_calendar_draft",
    title: "יצירת טיוטת לו\"ז",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "יוצר טיוטה משותפת חדשה. עם from/to — הטיוטה מתחילה מעותק של האירועים בטווח; " +
        "בלעדיהם — טיוטה ריקה. הלו\"ז החי לא משתנה.",
    parameters: {
        type: "object",
        properties: { label: LABEL_PARAM, from: ISO_DATE, to: ISO_DATE },
        required: ["label"],
        additionalProperties: false,
    },
    describe: (args) => `יצירת טיוטה "${args.label}"`,
    impact: (args) => [
        args.from && args.to
            ? `הטיוטה תכיל עותק של האירועים ב-${formatRange(args.from, args.to)}.`
            : "טיוטה ריקה.",
        'הלו"ז החי לא ישתנה.',
    ],
    async execute(args, context) {
        const controller = await context.writeController();
        if (Boolean(args.from) !== Boolean(args.to)) {
            throw new ClientApiError("יש לציין גם from וגם to, או אף אחד מהם");
        }
        const events =
            args.from && args.to
                ? await eventsInRange(args.from, args.to, controller)
                : [];
        const draft = await DbCalendarDraft.create(
            args.label,
            events,
            { id: context.actor.id, displayName: context.actor.displayName },
            controller,
            context.iterationId,
        );
        return { data: draft, summary: `נוצרה טיוטה "${draft.label}"` };
    },
};

export const deleteCalendarDraftTool: AiTool<{ id: string }> = {
    name: "delete_calendar_draft",
    title: "מחיקת טיוטת לו\"ז",
    danger: AiToolDanger.Destructive,
    kind: AiToolKind.Write,
    description: "מוחק טיוטה משותפת לצמיתות. הלו\"ז החי לא משתנה.",
    parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    describe: (args) => `מחיקת טיוטה ${args.id}`,
    impact: () => ["הטיוטה תימחק עבור כל המשתמשים, ללא שחזור."],
    async execute(args, context) {
        await DbCalendarDraft.del(args.id, await context.writeController());
        return { data: { id: args.id, deleted: true }, summary: "הטיוטה נמחקה" };
    },
};

export const listCalendarSnapshotsTool: AiTool<PageArgs> = {
    name: "list_calendar_snapshots",
    title: "נקודות שחזור",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את נקודות השחזור (snapshots) של הלו\"ז, מהחדשה לישנה.",
    parameters: { type: "object", properties: { ...PAGE_PARAMS }, additionalProperties: false },
    async execute(args, context) {
        const snapshots = await DbCalendarSnapshot.list(
            await context.readController(),
            context.iterationId,
        );
        const page = paginate(snapshots, args);
        return { data: page, summary: pageSummary(page, "נקודות שחזור") };
    },
};

type CreateSnapshotArgs = { label: string; from: string; to: string };

export const createCalendarSnapshotTool: AiTool<CreateSnapshotArgs> = {
    name: "create_calendar_snapshot",
    title: "יצירת נקודת שחזור",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "שומר נקודת שחזור של האירועים בטווח תאריכים. מומלץ לפני שינוי גורף.",
    parameters: {
        type: "object",
        properties: { label: LABEL_PARAM, from: ISO_DATE, to: ISO_DATE },
        required: ["label", "from", "to"],
        additionalProperties: false,
    },
    describe: (args) => `נקודת שחזור "${args.label}"`,
    impact: (args) => [
        `יישמר עותק של האירועים ב-${formatRange(args.from, args.to)}.`,
        'הלו"ז החי לא ישתנה.',
    ],
    async execute(args, context) {
        const controller = await context.writeController();
        const snapshot = await DbCalendarSnapshot.create(
            args.label,
            await eventsInRange(args.from, args.to, controller),
            controller,
            context.iterationId,
        );
        return { data: snapshot, summary: `נשמרה נקודת שחזור "${snapshot.label}"` };
    },
};

export const restoreCalendarSnapshotTool: AiTool<{ id: string }> = {
    name: "restore_calendar_snapshot",
    title: "שחזור לו\"ז מנקודת שחזור",
    danger: AiToolDanger.Destructive,
    kind: AiToolKind.Write,
    description:
        "מחליף את הלו\"ז בטווח של נקודת השחזור במצב השמור בה. פעולה מסוכנת: " +
        "כל שינוי שנעשה מאז בטווח הזה יאורכב. הצע קודם create_calendar_snapshot.",
    parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    describe: (args) => `שחזור הלו"ז מנקודת שחזור ${args.id}`,
    impact: () => [
        'כל האירועים החיים בטווח נקודת השחזור יאורכבו ויוחלפו בגרסה השמורה.',
        "שינויים שנעשו מאז בטווח הזה יאבדו מהלו\"ז.",
        "כל המשתמשים והחניכים יראו את השינוי מיד.",
    ],
    async execute(args, context) {
        const result = await DbCalendarSnapshot.restore(
            args.id,
            await context.writeController(),
            context.iterationId,
        );
        return {
            data: result,
            summary: `שוחזרו ${result.restoredCount} אירועים, אורכבו ${result.removedCount}`,
        };
    },
};

// ---------------------------------------------------------------------------
// Settings (read-only)
// ---------------------------------------------------------------------------

const SETTING_NAMES: Array<SettingName> = [
    MEAL_TIMES_SETTING_KEY,
    PRAYER_TIMES_SETTING_KEY,
    SCHEDULE_SETTINGS_KEY,
];

export const getSettingsTool: AiTool<{ name: SettingName }> = {
    name: "get_settings",
    title: "הגדרות המחזור",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description:
        "מחזיר הגדרה של המחזור: זמני ארוחות, זמני תפילות או הגדרות לו\"ז. " +
        "חוקי הגזירה וההפסקות נגזרים מהן. קריאה בלבד.",
    parameters: {
        type: "object",
        properties: { name: { type: "string", enum: SETTING_NAMES } },
        required: ["name"],
        additionalProperties: false,
    },
    async execute(args, context) {
        if (!SETTING_NAMES.includes(args.name)) {
            throw new ClientApiError(`הגדרה לא מוכרת: ${args.name}`);
        }
        const value = await DbSettings.get(
            args.name,
            undefined,
            await context.readController(),
        );
        return { data: value, summary: `נטענה ההגדרה ${args.name}` };
    },
};

export const CALENDAR_ENTITY_TOOLS = [
    ...COURSE_TOOLS,
    ...OUTSIDER_TOOLS,
    ...ROOM_TOOLS,
    setRoomExtendedInfoTool,
    listReservationsTool,
    createReservationTool,
    deleteReservationTool,
    listCalendarDraftsTool,
    createCalendarDraftTool,
    deleteCalendarDraftTool,
    listCalendarSnapshotsTool,
    createCalendarSnapshotTool,
    restoreCalendarSnapshotTool,
    getSettingsTool,
] as Array<AiTool<any>>;
