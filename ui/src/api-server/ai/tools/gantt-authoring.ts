/**
 * Gantt authoring tools — reading and editing the curriculum tree
 * (curriculum → syllabus → module → gantt event, plus weeks, days and
 * constraints) in PostgreSQL.
 *
 * Every call goes through the same `Db*` gantt objects the REST routes use,
 * so the enum validation, junction bookkeeping and meal-break seeding a UI
 * edit gets apply here unchanged.
 */

import {
    changedFieldsImpact,
    PAGE_PARAMS,
    PageArgs,
    pageSummary,
    paginate,
    pickDefined,
    requireText,
} from "@/api-server/ai/tools/common";
import { requireCurriculumId, CURRICULUM_ID_PARAM } from "@/api-server/ai/tools/gantt";
import { AiTool } from "@/api-server/ai/tools/types";
import {
    constraintInsertFromPayload,
    createConstraint,
    deleteConstraint,
    getConstraintsForOwner,
} from "@/api-server/gantt/db-constraints";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { DbDay } from "@/api-server/gantt/db-day";
import { DbModule } from "@/api-server/gantt/db-module";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { DbWeek } from "@/api-server/gantt/db-week";
import { dayjs } from "@/api-shared/dayjs-setup";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { CreateConstraintPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    EventRecurrence,
    GanttDayIndex,
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";
import {
    CURRICULUM_TEMPLATES,
    seedCurriculumFromTemplateWith,
} from "@/api-shared/types/gantt/templates";

/** Loosely typed view of the relational rows `getItem` returns. */
type Row = Record<string, any>;

const idParam = (description: string) => ({ type: "string", description });

/** Titles and ids of a junction list, in stored order. */
function childSummaries(links: Array<Row> | undefined, key: string) {
    return (links ?? []).map((link) => {
        const child = link[key] as Row;
        return { id: child.id, title: child.title ?? child.number ?? child.dayIndex };
    });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listSyllabusesTool: AiTool<{ curriculumId?: string } & PageArgs> = {
    name: "list_syllabuses",
    title: "סילבוסים בגאנט",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את הסילבוסים של גאנט, עם המזהה והשם שלהם.",
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM, ...PAGE_PARAMS },
        additionalProperties: false,
    },
    async execute(args, context) {
        const curriculum = (await DbCurriculum.getItem(
            requireCurriculumId(args, context),
        )) as Row;
        const page = paginate(childSummaries(curriculum.c2s, "syllabus"), args);
        return { data: page, summary: pageSummary(page, "סילבוסים") };
    },
};

export const getSyllabusTool: AiTool<{ syllabusId: string }> = {
    name: "get_syllabus",
    title: "פרטי סילבוס",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר סילבוס אחד עם פרטיו ורשימת המערכים (מודולים) שלו.",
    parameters: {
        type: "object",
        properties: { syllabusId: idParam("מזהה הסילבוס") },
        required: ["syllabusId"],
        additionalProperties: false,
    },
    async execute(args) {
        const { s2m, ...syllabus } = (await DbSyllabus.getItem(
            args.syllabusId as GanttSyllabusId,
        )) as Row;
        return {
            data: { ...syllabus, modules: childSummaries(s2m, "module") },
            summary: `נטען הסילבוס "${syllabus.title}"`,
        };
    },
};

export const listModulesTool: AiTool<{ syllabusId: string } & PageArgs> = {
    name: "list_modules",
    title: "מערכים בסילבוס",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את המערכים (מודולים) של סילבוס, לפי הסדר.",
    parameters: {
        type: "object",
        properties: { syllabusId: idParam("מזהה הסילבוס"), ...PAGE_PARAMS },
        required: ["syllabusId"],
        additionalProperties: false,
    },
    async execute(args) {
        const syllabus = (await DbSyllabus.getItem(
            args.syllabusId as GanttSyllabusId,
        )) as Row;
        const page = paginate(childSummaries(syllabus.s2m, "module"), args);
        return { data: page, summary: pageSummary(page, "מערכים") };
    },
};

export const getModuleTool: AiTool<{ moduleId: string }> = {
    name: "get_module",
    title: "פרטי מערך",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר מערך (מודול) אחד עם פרטיו ורשימת המופעים שלו.",
    parameters: {
        type: "object",
        properties: { moduleId: idParam("מזהה המערך") },
        required: ["moduleId"],
        additionalProperties: false,
    },
    async execute(args) {
        const { m2e, ...moduleRow } = (await DbModule.getItem(
            args.moduleId as GanttModuleId,
        )) as Row;
        return {
            data: { ...module, events: childSummaries(m2e, "event") },
            summary: `נטען המערך "${moduleRow.title}"`,
        };
    },
};

export const listGanttEventsTool: AiTool<{ moduleId: string } & PageArgs> = {
    name: "list_gantt_events",
    title: "מופעים במערך",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את המופעים (אירועי גאנט) של מערך, לפי הסדר, עם סוג ומשך.",
    parameters: {
        type: "object",
        properties: { moduleId: idParam("מזהה המערך"), ...PAGE_PARAMS },
        required: ["moduleId"],
        additionalProperties: false,
    },
    async execute(args) {
        const moduleRow = (await DbModule.getItem(args.moduleId as GanttModuleId)) as Row;
        const events = (moduleRow.m2e ?? []).map((link: Row) => ({
            id: link.event.id,
            title: link.event.title,
            type: link.event.type,
            minimumDuration: link.event.minimumDuration,
        }));
        const page = paginate(events, args);
        return { data: page, summary: pageSummary(page, "מופעים") };
    },
};

export const getGanttEventTool: AiTool<{ eventId: string }> = {
    name: "get_gantt_event",
    title: "פרטי מופע",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description:
        "מחזיר מופע (אירוע גאנט) אחד עם כל שדותיו, כולל הזמן המוקצה לו בכל גאנט (cEC).",
    parameters: {
        type: "object",
        properties: { eventId: idParam("מזהה המופע") },
        required: ["eventId"],
        additionalProperties: false,
    },
    async execute(args) {
        const event = (await DbModuleEvent.getItem(args.eventId as GanttModuleId)) as Row;
        return { data: event, summary: `נטען המופע "${event.title}"` };
    },
};

type OwnerArgs = { ownerId: string; ownerType: "event" | "module" };

const OWNER_PARAMS = {
    ownerId: idParam("מזהה המופע או המערך שהאילוץ שייך לו"),
    ownerType: { type: "string", enum: ["event", "module"] },
};

export const listConstraintsTool: AiTool<OwnerArgs> = {
    name: "list_constraints",
    title: "אילוצים",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את האילוצים (קדימות, ימים מותרים/אסורים) של מופע או מערך.",
    parameters: {
        type: "object",
        properties: OWNER_PARAMS,
        required: ["ownerId", "ownerType"],
        additionalProperties: false,
    },
    async execute(args) {
        const constraints = await getConstraintsForOwner(
            args.ownerId as GanttEventId,
            args.ownerType,
        );
        return { data: constraints, summary: `נמצאו ${constraints.length} אילוצים` };
    },
};

export const listWeeksTool: AiTool<{ curriculumId?: string } & PageArgs> = {
    name: "list_weeks",
    title: "שבועות בגאנט",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description: "מחזיר את שבועות הגאנט: מספר, תאריכים, הערה וסגירת שבת (weekendDuty).",
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM, ...PAGE_PARAMS },
        additionalProperties: false,
    },
    async execute(args, context) {
        const curriculum = (await DbCurriculum.getItem(
            requireCurriculumId(args, context),
        )) as Row;
        // Same mapping as the Gantt screen's getDayDate: the sorted position,
        // not the week number, is the offset from startDate.
        const start = curriculum.startDate ? dayjs(curriculum.startDate).startOf("day") : null;
        const weeks = (curriculum.c2w ?? [])
            .map((link: Row) => link.week)
            .sort((a: Row, b: Row) => a.number - b.number)
            .map((week: Row, index: number) => ({
                id: week.id,
                number: week.number,
                from: start?.add(index * 7, "day").format("YYYY-MM-DD") ?? null,
                to: start?.add(index * 7 + 6, "day").format("YYYY-MM-DD") ?? null,
                comment: week.comment,
                weekendDuty: week.weekendDuty,
            }));
        const page = paginate(weeks, args);
        return {
            data: page,
            summary: pageSummary(page, "שבועות"),
            hints: [
                'שבוע גאנט הוא תכנון. מה שקורה בפועל בתאריכים from–to נמצא בלו"ז (list_events).',
                ...(start ? [] : ["לגאנט אין startDate, ולכן אין לשבועות תאריכים."]),
            ],
        };
    },
};

export const listDaysTool: AiTool<{ weekId: string }> = {
    name: "list_days",
    title: "ימים בשבוע",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description:
        "מחזיר את ימי שבוע בגאנט: אינדקס יום (0=ראשון), דקות עבודה, שעת סיום והערה.",
    parameters: {
        type: "object",
        properties: { weekId: idParam("מזהה השבוע") },
        required: ["weekId"],
        additionalProperties: false,
    },
    async execute(args) {
        const week = (await DbWeek.getItem(args.weekId)) as Row;
        const days = (week.w2d ?? [])
            .map((link: Row) => link.day)
            .sort((a: Row, b: Row) => a.dayIndex - b.dayIndex);
        return { data: days, summary: `נמצאו ${days.length} ימים` };
    },
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** One gantt level's create/edit/delete, described once. */
type GanttEntitySpec = {
    entity: string;
    noun: string;
    idField: string;
    parent?: { field: string; description: string };
    /** Editable columns, as JSON-schema properties. */
    fields: Record<string, Record<string, unknown>>;
    requiredOnCreate: Array<string>;
    labels: Record<string, string>;
    store: {
        createNewItem: (payload: any) => Promise<any>;
        updateItem: (id: any, data: any) => Promise<any>;
        deleteItem: (id: any) => Promise<void>;
    };
    /** Defaults for NOT NULL columns without a DB default. */
    createDefaults?: Record<string, unknown>;
    deleteImpact: Array<string>;
    /** Extra work after a create — e.g. setting allocated time. */
    afterCreate?: (created: Row, args: Row, context: Parameters<AiTool["execute"]>[1]) => Promise<void>;
    /** Fields accepted on create only (not edit). */
    createOnlyFields?: Record<string, Record<string, unknown>>;
};

/**
 * Builds create/edit/delete for one level of the tree. The four levels differ
 * only in fields and parent, and sharing the builder keeps their approval
 * wording and partial-update rule identical.
 */
function ganttEntityTools(spec: GanttEntitySpec): Array<AiTool<any>> {
    const editable = Object.keys(spec.fields);

    const create: AiTool<Row> = {
        name: `create_${spec.entity}`,
        title: `יצירת ${spec.noun}`,
        danger: AiToolDanger.Caution,
        kind: AiToolKind.Write,
        description: `יוצר ${spec.noun} חדש${spec.parent ? ` תחת ${spec.parent.description}` : ""}.`,
        parameters: {
            type: "object",
            properties: {
                ...(spec.parent
                    ? { [spec.parent.field]: idParam(spec.parent.description) }
                    : {}),
                ...spec.fields,
                ...spec.createOnlyFields,
            },
            required: [
                ...(spec.parent ? [spec.parent.field] : []),
                ...spec.requiredOnCreate,
            ],
            additionalProperties: false,
        },
        describe: (args) => `יצירת ${spec.noun} "${String(args.title)}"`,
        impact: (args) => [`${spec.noun} חדש בשם "${String(args.title)}" יתווסף לגאנט.`],
        async execute(args, context) {
            for (const field of spec.requiredOnCreate) {
                if (args[field] === undefined) {
                    throw new ClientApiError(`השדה ${field} חובה`);
                }
            }
            requireText(args.title, "title");
            if (spec.parent) requireText(args[spec.parent.field], spec.parent.field);
            const created = (await spec.store.createNewItem({
                ...spec.createDefaults,
                ...pickDefined(args, editable),
                ...(spec.parent ? { [spec.parent.field]: args[spec.parent.field] } : {}),
            })) as Row;
            await spec.afterCreate?.(created, args, context);
            return { data: created, summary: `נוצר ${spec.noun} "${created.title}"` };
        },
    };

    const edit: AiTool<Row> = {
        name: `edit_${spec.entity}`,
        title: `עריכת ${spec.noun}`,
        danger: AiToolDanger.Caution,
        kind: AiToolKind.Write,
        description: `מעדכן ${spec.noun} קיים. העבר רק את השדות שמשתנים.`,
        parameters: {
            type: "object",
            properties: { [spec.idField]: idParam(`מזהה ה${spec.noun}`), ...spec.fields },
            required: [spec.idField],
            additionalProperties: false,
        },
        describe: (args) => `עריכת ${spec.noun} ${String(args[spec.idField])}`,
        impact: (args) => changedFieldsImpact(args, spec.labels),
        async execute(args) {
            const updated = (await spec.store.updateItem(
                args[spec.idField],
                pickDefined(args, editable),
            )) as Row;
            return { data: updated, summary: `עודכן ${spec.noun} "${updated.title}"` };
        },
    };

    const remove: AiTool<Row> = {
        name: `delete_${spec.entity}`,
        title: `מחיקת ${spec.noun}`,
        danger: AiToolDanger.Destructive,
        kind: AiToolKind.Write,
        description: `מוחק ${spec.noun} לצמיתות. ודא מול המשתמש שזה הנכון.`,
        parameters: {
            type: "object",
            properties: { [spec.idField]: idParam(`מזהה ה${spec.noun}`) },
            required: [spec.idField],
            additionalProperties: false,
        },
        describe: (args) => `מחיקת ${spec.noun} ${String(args[spec.idField])}`,
        impact: () => [...spec.deleteImpact, "המחיקה סופית ואין לה שחזור."],
        async execute(args) {
            await spec.store.deleteItem(args[spec.idField]);
            return {
                data: { id: args[spec.idField], deleted: true },
                summary: `נמחק ${spec.noun}`,
            };
        },
    };

    return [create, edit, remove];
}

const TITLE = { type: "string", description: "שם" };
const DESCRIPTION = { type: "string", description: "תיאור" };
const HIVE_IDS = {
    type: "array",
    items: { type: "integer" },
    description: "מזהי הייב מקושרים (מקצוע/מודול). השמט אם לא ידוע — אל תמציא.",
};

export const CURRICULUM_WRITE_TOOLS = ganttEntityTools({
    entity: "curriculum",
    noun: "גאנט",
    idField: "curriculumId",
    fields: {
        title: TITLE,
        description: DESCRIPTION,
        startDate: { type: ["string", "null"], description: "תאריך התחלה YYYY-MM-DD" },
        isDraft: { type: "boolean", description: "טיוטה — לא ניתן לגזור" },
    },
    requiredOnCreate: ["title"],
    labels: {
        title: "שם הגאנט ישונה",
        description: "התיאור יוחלף",
        startDate: "תאריך ההתחלה ישונה",
        isDraft: "סטטוס הטיוטה ישונה",
    },
    store: DbCurriculum,
    createDefaults: { description: "", isDraft: true, isArchived: false },
    deleteImpact: ["כל הסילבוסים, המערכים, המופעים והשבועות של הגאנט יימחקו."],
});

export const SYLLABUS_WRITE_TOOLS = ganttEntityTools({
    entity: "syllabus",
    noun: "סילבוס",
    idField: "syllabusId",
    parent: { field: "curriculumId", description: "הגאנט" },
    fields: {
        title: TITLE,
        description: DESCRIPTION,
        hiveIds: HIVE_IDS,
        shuffles: {
            type: "array",
            items: { type: "string" },
            description: "שמות השאפלים (קבוצות) בסילבוס",
        },
    },
    requiredOnCreate: ["title"],
    labels: {
        title: "שם הסילבוס ישונה",
        description: "התיאור יוחלף",
        hiveIds: "קישורי ההייב יוחלפו",
        shuffles: "רשימת השאפלים תוחלף",
    },
    store: DbSyllabus,
    createDefaults: { hiveIds: [] },
    deleteImpact: ["הסילבוס יוסר מהגאנט, וכל המערכים והמופעים שלו."],
});

export const MODULE_WRITE_TOOLS = ganttEntityTools({
    entity: "module",
    noun: "מערך",
    idField: "moduleId",
    parent: { field: "syllabusId", description: "הסילבוס" },
    fields: { title: TITLE, description: DESCRIPTION, hiveIds: HIVE_IDS },
    requiredOnCreate: ["title"],
    labels: {
        title: "שם המערך ישונה",
        description: "התיאור יוחלף",
        hiveIds: "קישורי ההייב יוחלפו",
    },
    store: DbModule,
    createDefaults: { description: "", hiveIds: [] },
    deleteImpact: ["המערך וכל המופעים שבו יימחקו."],
});

export const GANTT_EVENT_WRITE_TOOLS = ganttEntityTools({
    entity: "gantt_event",
    noun: "מופע",
    idField: "eventId",
    parent: { field: "moduleId", description: "המערך" },
    fields: {
        title: TITLE,
        // `type` is the one NOT NULL column with no DB default: omitting it
        // 500s, so the schema demands it on create.
        type: {
            type: "string",
            enum: Object.values(ModuleEventType),
            description: 'סוג המופע: הרצאה, ע"ע (עבודה עצמית), ל"ע (למידה עצמית) או אחר',
        },
        minimumDuration: { type: "integer", minimum: 0, description: "משך מינימלי בדקות" },
        roomRequirement: { type: "string", enum: Object.values(RoomRequirement) },
        recurrence: { type: "string", enum: Object.values(EventRecurrence) },
        isCritical: { type: "boolean" },
        comment: { type: ["string", "null"] },
    },
    // Not a column of the event row: it is per-curriculum config written
    // separately, so it is accepted on create only and applied afterwards.
    createOnlyFields: {
        allocatedDuration: {
            type: "integer",
            minimum: 0,
            description:
                "זמן מוקצה בדקות בגאנט הנוכחי. נשמר בנפרד מהמופע (לפי גאנט).",
        },
        curriculumId: CURRICULUM_ID_PARAM,
    },
    requiredOnCreate: ["title", "type"],
    labels: {
        title: "שם המופע ישונה",
        type: "סוג המופע ישונה",
        minimumDuration: "המשך המינימלי ישונה",
        roomRequirement: "דרישת החדר תשונה",
        recurrence: "החזרתיות תשונה",
        isCritical: "סימון קריטי ישונה",
        comment: "ההערה תוחלף",
    },
    store: DbModuleEvent,
    deleteImpact: ["המופע יוסר מהמערך. אירועי לו\"ז שנגזרו ממנו יישארו."],
    async afterCreate(created, args, context) {
        if (args.allocatedDuration === undefined) return;
        await DbModuleEvent.setAllocatedTime(
            created.id,
            requireCurriculumId(args, context),
            args.allocatedDuration,
        );
    },
});

type SetAllocatedTimeArgs = { eventId: string; curriculumId?: string; minutes: number };

export const setGanttEventTimeTool: AiTool<SetAllocatedTimeArgs> = {
    name: "set_gantt_event_time",
    title: "הקצאת זמן למופע",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description: "קובע את הזמן המוקצה (בדקות) למופע בגאנט מסוים.",
    parameters: {
        type: "object",
        properties: {
            eventId: idParam("מזהה המופע"),
            curriculumId: CURRICULUM_ID_PARAM,
            minutes: { type: "integer", minimum: 0 },
        },
        required: ["eventId", "minutes"],
        additionalProperties: false,
    },
    describe: (args) => `הקצאת ${args.minutes} דקות למופע ${args.eventId}`,
    impact: (args) => [`הזמן המוקצה למופע יהיה ${args.minutes} דקות בגאנט הזה.`],
    async execute(args, context) {
        await DbModuleEvent.setAllocatedTime(
            args.eventId as GanttEventId,
            requireCurriculumId(args, context),
            args.minutes,
        );
        return { data: args, summary: `הוקצו ${args.minutes} דקות` };
    },
};

type CreateConstraintArgs = OwnerArgs & {
    type: ConstraintType;
    targetId?: string;
    targetType?: "event" | "module";
    relation?: "after" | "before";
    minDelayDays?: number;
    maxDelayDays?: number;
    allowedDays?: Array<GanttDayIndex>;
    forbiddenDays?: Array<GanttDayIndex>;
};

const DAYS_PARAM = {
    type: "array",
    items: { type: "integer", minimum: 0, maximum: 6 },
    description: "אינדקסי ימים: 0=ראשון … 6=שבת",
};

export const createConstraintTool: AiTool<CreateConstraintArgs> = {
    name: "create_constraint",
    title: "יצירת אילוץ",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "יוצר אילוץ על מופע או מערך. RELATIONAL — לפני/אחרי יעד (targetId), עם " +
        "השהייה אופציונלית בימים. TEMPORAL — ימים מותרים או אסורים.",
    parameters: {
        type: "object",
        properties: {
            ...OWNER_PARAMS,
            type: { type: "string", enum: Object.values(ConstraintType) },
            targetId: { type: "string" },
            targetType: { type: "string", enum: ["event", "module"] },
            relation: { type: "string", enum: ["after", "before"] },
            minDelayDays: { type: "integer", minimum: 0 },
            maxDelayDays: { type: "integer", minimum: 0 },
            allowedDays: DAYS_PARAM,
            forbiddenDays: DAYS_PARAM,
        },
        required: ["ownerId", "ownerType", "type"],
        additionalProperties: false,
    },
    describe: (args) => `יצירת אילוץ ${args.type} על ${args.ownerId}`,
    impact: (args) => [
        args.type === ConstraintType.Relational
            ? `${args.ownerId} יתוזמן ${args.relation === "before" ? "לפני" : "אחרי"} ${args.targetId}.`
            : "הגבלת ימים תחול על הגזירה הבאה.",
        "האילוץ ישפיע על כל גזירה עתידית של הגאנט.",
    ],
    async execute(args) {
        const { ownerId, ...rest } = args;
        const payload = {
            ...rest,
            id: crypto.randomUUID(),
            ...(args.ownerType === "event"
                ? { ownerEventId: ownerId }
                : { ownerModuleId: ownerId }),
        } as unknown as CreateConstraintPayload;
        const constraint = await createConstraint(constraintInsertFromPayload(payload));
        return { data: constraint, summary: "נוצר אילוץ" };
    },
};

export const deleteConstraintTool: AiTool<{ constraintId: string }> = {
    name: "delete_constraint",
    title: "מחיקת אילוץ",
    danger: AiToolDanger.Destructive,
    kind: AiToolKind.Write,
    description: "מוחק אילוץ לפי מזהה מ-list_constraints.",
    parameters: {
        type: "object",
        properties: { constraintId: { type: "string" } },
        required: ["constraintId"],
        additionalProperties: false,
    },
    describe: (args) => `מחיקת אילוץ ${args.constraintId}`,
    impact: () => ["האילוץ יוסר ולא ישפיע על גזירות עתידיות."],
    async execute(args) {
        await deleteConstraint(args.constraintId);
        return { data: { id: args.constraintId, deleted: true }, summary: "האילוץ נמחק" };
    },
};

type EditWeekArgs = { weekId: string; comment?: string; weekendDuty?: boolean };

export const editWeekTool: AiTool<EditWeekArgs> = {
    name: "edit_week",
    title: "עריכת שבוע",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description: "מעדכן הערה או תורנות סופ\"ש של שבוע בגאנט. מספר השבוע קבוע.",
    parameters: {
        type: "object",
        properties: {
            weekId: idParam("מזהה השבוע"),
            comment: { type: "string" },
            weekendDuty: { type: "boolean" },
        },
        required: ["weekId"],
        additionalProperties: false,
    },
    describe: (args) => `עריכת שבוע ${args.weekId}`,
    impact: (args) =>
        changedFieldsImpact(args, {
            comment: "הערת השבוע תוחלף",
            weekendDuty: 'סימון תורנות סופ"ש ישונה',
        }),
    async execute(args) {
        const week = await DbWeek.updateItem(
            args.weekId,
            pickDefined(args, ["comment", "weekendDuty"]),
        );
        return { data: week, summary: "השבוע עודכן" };
    },
};

type EditDayArgs = {
    dayId: string;
    totalWorkingMinutes?: number;
    dayEndTime?: null | string;
    comment?: string;
};

export const editDayTool: AiTool<EditDayArgs> = {
    name: "edit_day",
    title: "עריכת יום",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description: "מעדכן דקות עבודה, שעת סיום או הערה של יום בגאנט.",
    parameters: {
        type: "object",
        properties: {
            dayId: idParam("מזהה היום"),
            totalWorkingMinutes: { type: "integer", minimum: 0, maximum: 1440 },
            dayEndTime: { type: ["string", "null"], description: "HH:mm" },
            comment: { type: "string" },
        },
        required: ["dayId"],
        additionalProperties: false,
    },
    describe: (args) => `עריכת יום ${args.dayId}`,
    impact: (args) =>
        changedFieldsImpact(args, {
            totalWorkingMinutes: "דקות העבודה ביום ישונו",
            dayEndTime: "שעת סיום היום תשונה",
            comment: "הערת היום תוחלף",
        }),
    async execute(args) {
        const day = await DbDay.updateItem(
            args.dayId,
            pickDefined(args, ["totalWorkingMinutes", "dayEndTime", "comment"]),
        );
        return { data: day, summary: "היום עודכן" };
    },
};

type ApplyTemplateArgs = { curriculumId?: string; templateId: string };

export const applyCurriculumTemplateTool: AiTool<ApplyTemplateArgs> = {
    name: "apply_curriculum_template",
    title: "החלת תבנית על גאנט",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "יוצר שבועות וימים בגאנט לפי תבנית מוכנה (מספר שבועות ודקות עבודה לכל יום). " +
        "מיועד לגאנט ריק; על גאנט קיים השבועות יתווספו אחרי הקיימים. " +
        `תבניות: ${CURRICULUM_TEMPLATES.map((t) => `${t.id} (${t.label})`).join(", ")}.`,
    parameters: {
        type: "object",
        properties: {
            curriculumId: CURRICULUM_ID_PARAM,
            templateId: {
                type: "string",
                enum: CURRICULUM_TEMPLATES.map((template) => template.id),
            },
        },
        required: ["templateId"],
        additionalProperties: false,
    },
    describe: (args) => `החלת תבנית ${args.templateId}`,
    impact: (args) => {
        const template = CURRICULUM_TEMPLATES.find((t) => t.id === args.templateId);
        return [
            `ייווצרו ${template?.weekCount ?? "?"} שבועות חדשים בגאנט.`,
            "דקות העבודה לכל יום ייקבעו לפי התבנית.",
        ];
    },
    async execute(args, context) {
        const template = CURRICULUM_TEMPLATES.find((t) => t.id === args.templateId);
        if (!template) throw new ClientApiError(`תבנית לא מוכרת: ${args.templateId}`);
        const curriculumId = requireCurriculumId(args, context);
        await seedCurriculumFromTemplateWith(curriculumId, template, {
            createWeek: async (payload) => (await DbWeek.createNewItem(payload)) as Row,
            setDayMinutes: (dayId, totalWorkingMinutes) =>
                DbDay.updateItem(dayId, { totalWorkingMinutes }),
        });
        return {
            data: { curriculumId, templateId: template.id, weeks: template.weekCount },
            summary: `נוצרו ${template.weekCount} שבועות מתבנית ${template.label}`,
        };
    },
};

type ReorderArgs = {
    parentType: "module" | "syllabus";
    parentId: string;
    childIds: Array<string>;
};

export const reorderChildrenTool: AiTool<ReorderArgs> = {
    name: "reorder_children",
    title: "סידור מחדש",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "קובע סדר חדש לילדים: מערכים בסילבוס (parentType=syllabus) או מופעים במערך " +
        "(parentType=module). העבר את כל מזהי הילדים בסדר הרצוי.",
    parameters: {
        type: "object",
        properties: {
            parentType: { type: "string", enum: ["syllabus", "module"] },
            parentId: { type: "string" },
            childIds: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["parentType", "parentId", "childIds"],
        additionalProperties: false,
    },
    describe: (args) => `סידור מחדש של ${args.childIds.length} פריטים ב-${args.parentId}`,
    impact: () => ["סדר הפריטים ישתנה, ובעקבותיו סדר השיבוץ בגזירה הבאה."],
    async execute(args) {
        if (args.parentType === "syllabus") {
            await DbSyllabus.reorderModules(
                args.parentId as GanttSyllabusId,
                args.childIds as Array<GanttModuleId>,
            );
        } else {
            await DbModule.reorderEvents(
                args.parentId as GanttModuleId,
                args.childIds as Array<GanttEventId>,
            );
        }
        return { data: args, summary: "הסדר עודכן" };
    },
};

export const GANTT_AUTHORING_TOOLS = [
    listSyllabusesTool,
    getSyllabusTool,
    listModulesTool,
    getModuleTool,
    listGanttEventsTool,
    getGanttEventTool,
    listConstraintsTool,
    listWeeksTool,
    listDaysTool,
    ...CURRICULUM_WRITE_TOOLS,
    ...SYLLABUS_WRITE_TOOLS,
    ...MODULE_WRITE_TOOLS,
    ...GANTT_EVENT_WRITE_TOOLS,
    setGanttEventTimeTool,
    createConstraintTool,
    deleteConstraintTool,
    editWeekTool,
    editDayTool,
    applyCurriculumTemplateTool,
    reorderChildrenTool,
] as Array<AiTool<any>>;
