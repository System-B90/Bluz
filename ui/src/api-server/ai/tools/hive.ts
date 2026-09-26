/**
 * Hive tools — read-only. Hive's Event API cannot be written to, so the
 * assistant only reads reference data here: subjects, student groups, a
 * module's queues and lessons. Plus the iteration usage probe.
 */

import {
    NO_PARAMS,
    PAGE_PARAMS,
    PageArgs,
    pageSummary,
    paginate,
} from "@/api-server/ai/tools/common";
import { AiTool } from "@/api-server/ai/tools/types";
import { DbIterations } from "@/api-server/db-iterations";
import { createHiveClient } from "@/api-server/hive/session-client";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { Clearance, clearanceName } from "@/api-shared/types/hive";

/** Hive records are wide; the model needs the id, a label and the parent links. */
const HIVE_KEYS = ["id", "name", "display_name", "title", "subject", "module", "queue", "type"];

function projectHive(items: Array<object>): Array<Record<string, unknown>> {
    return items.map((item) => {
        const record = item as Record<string, unknown>;
        return Object.fromEntries(
            HIVE_KEYS.filter((key) => record[key] !== undefined).map((key) => [
                key,
                record[key],
            ]),
        );
    });
}

function hiveListTool<TArgs extends PageArgs>(spec: {
    name: string;
    title: string;
    description: string;
    noun: string;
    parameters?: Record<string, Record<string, unknown>>;
    required?: Array<string>;
    fetch: (args: TArgs) => Promise<Array<object>>;
}): AiTool<TArgs> {
    return {
        name: spec.name,
        title: spec.title,
        danger: AiToolDanger.Safe,
        kind: AiToolKind.Read,
        description: spec.description,
        recovery: ["אם הייב לא זמין — דווח למשתמש ואל תנחש נתונים."],
        parameters: {
            type: "object",
            properties: { ...spec.parameters, ...PAGE_PARAMS },
            required: spec.required ?? [],
            additionalProperties: false,
        },
        async execute(args) {
            const page = paginate(projectHive(await spec.fetch(args)), args);
            return { data: page, summary: pageSummary(page, spec.noun) };
        },
    };
}

export const listHiveSubjectsTool = hiveListTool<PageArgs>({
    name: "list_hive_subjects",
    title: "מקצועות הייב",
    description: "מחזיר את המקצועות (subjects) בהייב, עם מזהה ושם.",
    noun: "מקצועות",
    fetch: async () => await (await createHiveClient()).getSubjects(),
});

export const listHiveClassesTool = hiveListTool<PageArgs>({
    name: "list_hive_classes",
    title: "קבוצות הייב",
    description: "מחזיר את קבוצות החניכים (classes) בהייב.",
    noun: "קבוצות",
    fetch: async () => await (await createHiveClient()).getClasses(),
});

export const listHiveQueuesTool = hiveListTool<{ moduleId: number } & PageArgs>({
    name: "list_hive_queues",
    title: "תורי הייב",
    description: "מחזיר את התורים של מודול הייב אחד.",
    noun: "תורים",
    parameters: { moduleId: { type: "integer", description: "מזהה מודול הייב" } },
    required: ["moduleId"],
    fetch: async (args) =>
        await (await createHiveClient()).getModuleQueues(args.moduleId),
});

export const listHiveLessonsTool = hiveListTool<{ moduleId?: number } & PageArgs>({
    name: "list_hive_lessons",
    title: "שיעורי הייב",
    description: "מחזיר שיעורים (lessons) בהייב, אופציונלית של מודול אחד.",
    noun: "שיעורים",
    parameters: { moduleId: { type: "integer", description: "מזהה מודול הייב" } },
    fetch: async (args) =>
        await (await createHiveClient()).getLessons(
            args.moduleId ? { module: args.moduleId } : {},
        ),
});

type ListPeopleArgs = { ids?: Array<number>; nameContains?: string; staffOnly?: boolean } & PageArgs;

/**
 * Hive users by id or name. Events, gantt rows and syllabuses store people as
 * bare Hive user ids; without this the model can only answer "instructor 32".
 */
export const listPeopleTool: AiTool<ListPeopleArgs> = {
    name: "list_people",
    title: "אנשים",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description:
        "ממיר מזהי אנשים לשמות. instructors, lecturers, orchestratorId, " +
        "leadInstructorIds ודומיהם הם מזהי משתמשי הייב — העבר אותם ב-ids.",
    recovery: ["אם הייב לא זמין — הצג מזהים ואמור שהשמות לא זמינים."],
    parameters: {
        type: "object",
        properties: {
            ids: { type: "array", items: { type: "integer" }, description: "מזהי משתמשים" },
            nameContains: { type: "string", description: "חיפוש לפי חלק מהשם" },
            staffOnly: { type: "boolean", description: "true — סגל בלבד, בלי חניכים" },
            ...PAGE_PARAMS,
        },
        additionalProperties: false,
    },
    async execute(args) {
        const users = await (await createHiveClient()).getUsers();
        const wanted = args.ids?.length ? new Set(args.ids) : null;
        const people = users
            .filter((user) =>
                (!wanted || wanted.has(user.id)) &&
                (!args.nameContains || user.display_name.includes(args.nameContains)) &&
                (!args.staffOnly || user.clearance >= Clearance.Segel))
            .map((user) => ({
                id: user.id,
                name: user.display_name,
                role: clearanceName(user.clearance),
            }));
        const missing = wanted ? [...wanted].filter((id) => !people.some((p) => p.id === id)) : [];
        const page = paginate(people, args);
        return {
            data: page,
            summary: pageSummary(page, "אנשים"),
            hints: missing.length
                ? [`מזהים שלא נמצאו בהייב: ${missing.join(", ")}. הצג אותם כמזהה.`]
                : [],
        };
    },
};

export const getIterationUsageTool: AiTool<{ iterationId?: string }> = {
    name: "get_iteration_usage",
    title: "שימוש במחזור",
    danger: AiToolDanger.Safe,
    kind: AiToolKind.Read,
    description:
        "מחזיר מה תלוי במחזור: האם מקושר גאנט, האם יש אירועים, האם הוא הנוכחי.",
    parameters: {
        ...NO_PARAMS,
        properties: { iterationId: { type: "string", description: "ברירת מחדל: המחזור בהקשר" } },
    },
    async execute(args, context) {
        const id =
            args.iterationId ??
            context.iterationId ??
            (await DbIterations.current()).id;
        return { data: await DbIterations.usage(id), summary: `נטען שימוש במחזור ${id}` };
    },
};

export const HIVE_TOOLS = [
    listHiveSubjectsTool,
    listHiveClassesTool,
    listHiveQueuesTool,
    listHiveLessonsTool,
    listPeopleTool,
    getIterationUsageTool,
]as Array<AiTool<any>>;
