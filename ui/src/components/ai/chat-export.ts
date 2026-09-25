/**
 * Turns the assistant transcript into a downloadable file.
 *
 * Built from the transcript — what the model actually saw, tool calls and
 * their raw results included — rather than from the tidied timeline, so an
 * export is a faithful record of a conversation, not a screenshot of it.
 */

import { AiMessage, AiRole } from "@/api-shared/types/ai";

export enum ChatExportFormat {
    Markdown = "md",
    Json = "json",
}

export type ChatExportMeta = {
    exportedAt: Date;
    model?: string;
};

const ROLE_HEADING: Record<AiRole, string> = {
    [AiRole.System]: "מערכת",
    [AiRole.User]: "משתמש",
    [AiRole.Assistant]: "עוזר",
    [AiRole.Tool]: "תוצאת כלי",
};

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
