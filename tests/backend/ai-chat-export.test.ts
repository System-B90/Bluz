import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "@/api-server/ai/system-prompt";
import { AiToolContext } from "@/api-server/ai/tools/types";
import { AiRole } from "@/api-shared/types/ai";
import {
    buildChatExport,
    ChatExportFormat,
    transcriptToMarkdown,
} from "@/components/ai/chat-export";

/** Chat export (#719) and the system prompt's date/glossary grounding. */

const messages = [
    { role: AiRole.User, content: "מה יש מחר?" },
    {
        role: AiRole.Assistant,
        content: "",
        toolCalls: [
            { id: "c1", name: "list_events", arguments: '{"from":"a","to":"b"}' },
        ],
    },
    {
        role: AiRole.Tool,
        toolCallId: "c1",
        name: "list_events",
        content: '{"ok":true,"data":{"items":[]}}',
    },
    { role: AiRole.Assistant, content: "אין אירועים." },
];

const meta = { exportedAt: new Date("2026-03-01T10:00:00Z"), model: "m1" };

describe("chat export", () => {
    it("keeps tool calls and their results in the Markdown transcript", () => {
        const markdown = transcriptToMarkdown(messages, meta);
        expect(markdown).toContain("## משתמש");
        expect(markdown).toContain("קריאה לכלי `list_events`");
        expect(markdown).toContain('"from": "a"');
        expect(markdown).toContain("## תוצאת כלי: list_events");
        expect(markdown).toContain("אין אירועים.");
        expect(markdown).toContain("מודל: m1");
    });

    it("exports the raw transcript as JSON", () => {
        const file = buildChatExport(messages, ChatExportFormat.Json, meta);
        expect(file.fileName).toMatch(/^bluz-chat-.*\.json$/);
        expect(JSON.parse(file.content)).toMatchObject({ model: "m1", messages });
    });

    it("names Markdown exports .md", () => {
        const file = buildChatExport(messages, ChatExportFormat.Markdown, meta);
        expect(file.fileName).toMatch(/\.md$/);
        expect(file.mimeType).toBe("text/markdown");
    });
});

describe("system prompt grounding", () => {
    const context = {
        actor: { id: "u1", displayName: "מיכאל" },
        // 2026-03-03 is a Tuesday.
        now: new Date("2026-03-03T07:00:00Z"),
        readController: async () => ({}),
        writeController: async () => ({}),
    } as unknown as AiToolContext;

    it("states today's weekday, date and timezone", () => {
        const prompt = buildSystemPrompt(context);
        expect(prompt).toContain("יום שלישי, 2026-03-03");
        expect(prompt).toContain("Asia/Jerusalem");
    });

    it("carries a glossary of Bluz terms", () => {
        const prompt = buildSystemPrompt(context);
        for (const term of ["סילבוס", "גאנט", "אירוע", "מערך", "מופע", "פיקטיבי"]) {
            expect(prompt).toContain(`${term}`);
        }
        expect(prompt).toContain("סילבוס ← מערך ← מופע");
    });
});
