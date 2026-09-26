/**
 * Curriculum tools — the Gantt half of the assistant (PostgreSQL).
 *
 * The cut pipeline is reused as-is: the assistant can preview and run a cut,
 * but it cannot bypass the constraint engine, the meal-break rules, or the
 * draft guard, because it calls the same functions the Gantt screen calls.
 */

import { CURRICULUM_HINTS } from "@/api-server/ai/tools/hints";
import { AiTool, AiToolContext } from "@/api-server/ai/tools/types";
import { previewCurriculumCut, cutCurriculumToSchedule } from "@/api-server/gantt/cut";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getCurriculumExecution } from "@/api-server/gantt/execution";
import { ClientApiError } from "@/api-shared/errors";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";

/**
 * Resolves which curriculum a call targets: an explicit argument wins, and the
 * screen the user is on is the fallback, so "תגזור את זה" works without the
 * model having to guess an id.
 */
export function requireCurriculumId(
    args: { curriculumId?: string },
    context: AiToolContext,
): GanttCurriculumId {
    const id = args.curriculumId ?? context.curriculumId;
    if (!id) {
        throw new ClientApiError(
            "לא צוין גאנט. בקש מהמשתמש לציין איזה גאנט, או השתמש ב-list_curriculums",
        );
    }
    return id as GanttCurriculumId;
}

export const CURRICULUM_ID_PARAM = {
    type: "string",
    description:
        "מזהה הגאנט. אם המשתמש נמצא כרגע במסך גאנט אפשר להשמיט ולהשתמש בברירת המחדל.",
};

export const listCurriculumsTool: AiTool<Record<string, never>> = {
    name: "list_curriculums",
    title: "רשימת גאנטים",
    danger: AiToolDanger.Safe,
    description: "מחזיר את כל הגאנטים (תוכניות הלימוד) עם המזהה והשם שלהם.",
    kind: AiToolKind.Read,
    parameters: { type: "object", properties: {}, additionalProperties: false },

    async execute() {
        // `listItems` answers a map of id → title, not an array.
        const items = await DbCurriculum.listItems();
        return {
            data: items,
            summary: `נמצאו ${Object.keys(items).length} גאנטים`,
        };
    },
};

type CurriculumArgs = { curriculumId?: string };

export const getCurriculumTool: AiTool<CurriculumArgs> = {
    name: "get_curriculum",
    title: "מבנה הגאנט",
    danger: AiToolDanger.Safe,
    description:
        "מחזיר את עץ הגאנט המלא: סילבוסים, מודולים, שבועות וימים. " +
        "השתמש בזה כדי לענות על שאלות מבניות לפני כל שינוי.",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM },
        additionalProperties: false,
    },

    async execute(args, context) {
        const id = requireCurriculumId(args, context);
        const curriculum = await DbCurriculum.getItem(id);
        return {
            data: curriculum,
            summary: `נטען הגאנט "${curriculum.title ?? id}"`,
            hints: CURRICULUM_HINTS,
        };
    },
};

export const previewCutTool: AiTool<CurriculumArgs> = {
    name: "preview_curriculum_cut",
    title: "תצוגה מקדימה לגזירה",
    danger: AiToolDanger.Safe,
    nextSteps: [
        "הצג למשתמש בעברית כמה אירועים ייווצרו ואילו התנגשויות נמצאו.",
        "אל תקרא ל-cut_curriculum לפני שהמשתמש ראה את הסיכום הזה.",
    ],
    description:
        'מריץ הרצה יבשה של גזירת הגאנט ללו"ז ומחזיר את האירועים שייווצרו ואת ' +
        "ההתנגשויות שנמצאו, בלי לשנות דבר. הרץ את זה לפני cut_curriculum.",
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM },
        additionalProperties: false,
    },

    async execute(args, context) {
        const id = requireCurriculumId(args, context);
        const preview = await previewCurriculumCut(id);
        return { data: preview, summary: "בוצעה תצוגה מקדימה של הגזירה" };
    },
};

export const curriculumExecutionTool: AiTool<CurriculumArgs> = {
    name: "get_curriculum_execution",
    title: "תכנון מול ביצוע",
    danger: AiToolDanger.Safe,
    description:
        'מחזיר את פער התכנון מול הביצוע: לכל אירוע גאנט, מה תוכנן ומה בפועל בלו"ז.',
    kind: AiToolKind.Read,
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM },
        additionalProperties: false,
    },

    async execute(args, context) {
        const id = requireCurriculumId(args, context);
        const execution = await getCurriculumExecution(id);
        return {
            data: execution,
            summary: `נטען מצב ביצוע ל-${Object.keys(execution.events).length} אירועים`,
        };
    },
};

export const cutCurriculumTool: AiTool<CurriculumArgs> = {
    name: "cut_curriculum",
    title: 'גזירת הגאנט ללו"ז',
    danger: AiToolDanger.Destructive,
    recovery: [
        "אם הגזירה נכשלה בגלל טיוטה או התנגשות — אל תנסה שוב.",
        "הסבר למשתמש מה חסם ומה עליו לתקן בגאנט לפני גזירה חוזרת.",
    ],
    description:
        'גוזר את הגאנט ללו"ז בפועל — יוצר ומעדכן אירועים במחזור. פעולה ' +
        "משמעותית: הרץ preview_curriculum_cut קודם והצג למשתמש מה עומד לקרות.",
    kind: AiToolKind.Write,
    parameters: {
        type: "object",
        properties: { curriculumId: CURRICULUM_ID_PARAM },
        additionalProperties: false,
    },

    describe(args, context) {
        return `גזירת הגאנט ${args.curriculumId ?? context.curriculumId} ללו"ז`;
    },

    impact() {
        return [
            'הגזירה יוצרת ומעדכנת אירועים בלו"ז של המחזור בפועל.',
            "אירועים קיימים שנוצרו מגזירה קודמת יוחלפו.",
            "לא ניתן לבטל את הגזירה בלחיצה אחת — רק לתקן אירוע-אירוע.",
        ];
    },

    async execute(args, context) {
        const id = requireCurriculumId(args, context);
        // Attribute the cut to the assistant, not to a human pressing "cut"
        // (#545 item 3).
        const outcome = await cutCurriculumToSchedule(
            id,
            {},
            {
                actor: context.actor,
                initiator: EventChangeInitiator.AiAssistant,
            },
        );

        // The cut reports refusals (draft gantt, missing iteration, conflicts)
        // in-band rather than throwing; the model has to see that verdict.
        if (!outcome.ok) {
            return {
                data: outcome,
                summary: `הגזירה נכשלה: ${outcome.error.message}`,
            };
        }
        return { data: outcome, summary: 'הגאנט נגזר ללו"ז' };
    },
};

export const GANTT_TOOLS = [
    listCurriculumsTool,
    getCurriculumTool,
    previewCutTool,
    curriculumExecutionTool,
    cutCurriculumTool,
] as Array<AiTool<any>>;
