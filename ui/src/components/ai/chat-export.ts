/**
 * Turns the assistant transcript into a downloadable file.
 *
 * Built from the transcript — what the model actually saw, tool calls and
 * their raw results included — rather than from the tidied timeline, so an
 * export is a faithful record of a conversation, not a screenshot of it.
 */

import { AiMessage, AiRole } from "@/api-shared/types/ai";
import { AiBenchmarkResult } from "@/api-shared/types/ai-benchmark";

export enum ChatExportFormat {
    Markdown = "md",
    Json = "json",
}

export type ChatExportMeta = {
    exportedAt: Date;
    model?: string;
    /** Thinking/reasoning blocks, in order, for inclusion in export. */
    reasoning?: Array<{ text: string }>;
};

const ROLE_HEADING: Record<AiRole, string> = {
    [AiRole.System]: "מערכת",
    [AiRole.User]: "משתמש",
    [AiRole.Assistant]: "עוזר",
    [AiRole.Tool]: "תוצאת כלי",
};

const THINKING_HEADING = "שרשרת מחשבה (CoT)";
const THINKING_EMOJI = "🤔";

/** Pretty-prints a JSON string when it parses, verbatim otherwise. */
function prettyJson(raw: string): string {
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
}

function fence(body: string): string {
    return ["```json", body, "```"].join("\n");
}

export function transcriptToMarkdown(
    messages: Array<AiMessage>,
    meta: ChatExportMeta,
): string {
    const lines = [
        "# שיחה עם עוזר בלוז",
        "",
        `יוצא: ${meta.exportedAt.toISOString()}`,
        ...(meta.model ? [`מודל: ${meta.model}`] : []),
    ];

    for (const message of messages) {
        const heading =
            message.role === AiRole.Tool && message.name
                ? `${ROLE_HEADING[message.role]}: ${message.name}`
                : ROLE_HEADING[message.role];
        lines.push("", `## ${heading}`, "");
        if (message.role === AiRole.Tool) {
            lines.push(fence(prettyJson(message.content)));
            continue;
        }
        if (message.content) lines.push(message.content);
        for (const call of message.toolCalls ?? []) {
            lines.push(
                "",
                `**קריאה לכלי \`${call.name}\`** (${call.id})`,
                "",
                fence(prettyJson(call.arguments || "{}")),
            );
        }
    }

    // Include reasoning blocks if present
    if (meta.reasoning?.length) {
        lines.push("", `## ${THINKING_EMOJI} ${THINKING_HEADING}`, "");
        for (const block of meta.reasoning) {
            if (block.text.trim()) {
                lines.push(block.text, "");
            }
        }
    }

    return `${lines.join("\n")}\n`;
}

export function transcriptToJson(
    messages: Array<AiMessage>,
    meta: ChatExportMeta,
): string {
    return JSON.stringify(
        {
            exportedAt: meta.exportedAt.toISOString(),
            ...(meta.model ? { model: meta.model } : {}),
            messages,
            ...(meta.reasoning?.length ? { reasoning: meta.reasoning } : {}),
        },
        null,
        2,
    );
}

/** File name and body for one export. */
export function buildChatExport(
    messages: Array<AiMessage>,
    format: ChatExportFormat,
    meta: ChatExportMeta,
): { fileName: string; mimeType: string; content: string } {
    const stamp = meta.exportedAt.toISOString().replace(/[:.]/g, "-");
    return format === ChatExportFormat.Json
        ? {
            fileName: `bluz-chat-${stamp}.json`,
            mimeType: "application/json",
            content: transcriptToJson(messages, meta),
        }
        : {
            fileName: `bluz-chat-${stamp}.md`,
            mimeType: "text/markdown",
            content: transcriptToMarkdown(messages, meta),
        };
}

/**
 * JSON export of a self-test run: the system prompt once, then per case the
 * prompt, verdicts, and the full transcript (tool calls with raw arguments and
 * results) — what is needed to see why a tool or prompt misfired.
 */
export function buildBenchmarkExport(
    result: AiBenchmarkResult,
    exportedAt: Date,
): { fileName: string; mimeType: string; content: string } {
    const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
    return {
        fileName: `bluz-benchmark-${stamp}.json`,
        mimeType: "application/json",
        content: JSON.stringify(
            { exportedAt: exportedAt.toISOString(), ...result },
            null,
            2,
        ),
    };
}

/** Hands the file to the browser as a download. */
export function downloadChatExport(file: {
    fileName: string;
    mimeType: string;
    content: string;
}): void {
    const url = URL.createObjectURL(
        new Blob([file.content], { type: `${file.mimeType};charset=utf-8` }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = file.fileName;
    link.click();
    URL.revokeObjectURL(url);
}
