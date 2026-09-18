/**
 * The assistant's way of asking a question instead of guessing.
 *
 * Without it a model faced with "תמחק את השיעור של יום שני" and three matching
 * events either picks one — which is how an assistant deletes the wrong thing
 * — or writes a paragraph asking which, which the user then has to answer in
 * prose the model may misread. A structured prompt turns that into two
 * buttons.
 *
 * It is a tool only so the model can reach it the same way it reaches
 * everything else. It never executes: the agent loop intercepts the call,
 * streams the question to the browser and ends the turn, and the *client*
 * writes the chosen value back as the call's tool result.
 */

import { AiTool } from "@/api-server/ai/tools/types";
import { AiChoiceOption, AiToolDanger, AiToolKind } from "@/api-shared/types/ai";

export type AskUserArgs = {
    question: string;
    options: Array<AiChoiceOption>;
    allowFreeText?: boolean;
};

/** Caps the button list — a model given no ceiling will offer twenty. */
const MAX_OPTIONS = 6;

/**
 * Normalises what the model produced into something renderable. A missing
 * `value`, a duplicate, or an over-long list is a model mistake that must not
 * reach the UI as a broken button row.
 */
export function normalizeChoiceOptions(
    options: Array<AiChoiceOption> | undefined,
): Array<AiChoiceOption> {
    const seen = new Set<string>();
    const normalized: Array<AiChoiceOption> = [];

    for (const option of options ?? []) {
        const label = String(option?.label ?? option?.value ?? "").trim();
        if (!label) continue;
        const value = String(option?.value ?? label).trim();
        if (seen.has(value)) continue;
        seen.add(value);
        normalized.push({
            value,
            label,
            ...(option?.description ? { description: String(option.description) } : {}),
        });
        if (normalized.length === MAX_OPTIONS) break;
    }

    return normalized;
}

export const askUserTool: AiTool<AskUserArgs> = {
    name: "ask_user",
    title: "שאלה למשתמש",
    description:
        "שואל את המשתמש שאלה עם אפשרויות בחירה ועוצר עד שהוא עונה. " +
        "השתמש בזה כשחסר לך מידע שרק המשתמש יכול לתת, או כששאילתה " +
        "החזירה כמה תוצאות מתאימות ואתה צריך לדעת באיזו מדובר. " +
        "אל תשתמש בזה למידע שאפשר להביא בכלי קריאה.",
    kind: AiToolKind.Prompt,
    danger: AiToolDanger.Safe,
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "השאלה בעברית, משפט אחד קצר.",
            },
            options: {
                type: "array",
                description: `עד ${MAX_OPTIONS} אפשרויות בחירה.`,
                items: {
                    type: "object",
                    properties: {
                        value: {
                            type: "string",
                            description: "הערך שיחזור אליך כשהמשתמש יבחר.",
                        },
                        label: {
                            type: "string",
                            description: "הטקסט שיוצג על הכפתור.",
                        },
                        description: {
                            type: "string",
                            description: "הסבר קצר מתחת לכפתור.",
                        },
                    },
                    required: ["value", "label"],
                    additionalProperties: false,
                },
            },
            allowFreeText: {
                type: "boolean",
                description:
                    "האם לאפשר למשתמש להקליד תשובה חופשית במקום לבחור. ברירת מחדל: כן.",
            },
        },
        required: ["question", "options"],
        additionalProperties: false,
    },

    // Reached only if the interception in the agent loop is ever removed. It
    // throws rather than returning a placeholder so that regression surfaces
    // immediately instead of as a model silently answering its own question.
    execute() {
        throw new Error("ask_user מטופל על ידי לולאת הסוכן ולא מורץ ישירות");
    },
};
