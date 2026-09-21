/**
 * OpenRouter implementation of {@link AiProvider}. Thin config wrapper —
 * the wire handling (OpenAI-compatible Chat Completions) lives in
 * {@link OpenAiCompatibleProvider}.
 *
 * @see https://openrouter.ai/docs/api-reference/chat-completion
 */

import { OpenAiCompatibleProvider } from "@/api-server/ai/openai-compatible";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
// stealth/ox-alpha was OpenRouter's temporary testing slug and 404s now that
// its trial ended (superseded by z-ai/glm-5.3-flash per its own error body).
const DEFAULT_MODEL = "stealth/union-alpha";

export class OpenRouterProvider extends OpenAiCompatibleProvider {
    constructor(options: {
        apiKey: string;
        baseUrl?: string;
        defaultModel?: string;
        /** Attribution headers; OpenRouter uses them for rate-limit tiers. */
        referer?: string;
        title?: string;
    }) {
        super({
            name: "openrouter",
            apiKey: options.apiKey,
            missingKeyMessage: "לא הוגדר מפתח API לשירות ה-AI (OPENROUTER_API_KEY)",
            baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
            defaultModel: options.defaultModel ?? DEFAULT_MODEL,
            extraHeaders: {
                "HTTP-Referer": options.referer,
                "X-Title": options.title,
            },
        });
    }
}
