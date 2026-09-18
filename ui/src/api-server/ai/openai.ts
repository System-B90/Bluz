/**
 * OpenAI-compatible implementation of {@link AiProvider} for a directly
 * reachable endpoint — the real api.openai.com, or (the deployment this was
 * added for) a self-hosted, airgapped gateway in front of a model like Kimi
 * that speaks the same "v2" OpenAI-compatible chat-completions API.
 *
 * There is no public default `baseUrl`: an airgapped network has no route to
 * api.openai.com, so the operator's own gateway URL is required config, not a
 * fallback from one. The wire handling itself lives in
 * {@link OpenAiCompatibleProvider} — identical to OpenRouter's.
 */

import { OpenAiCompatibleProvider } from "@/api-server/ai/openai-compatible";
import { AiNotConfiguredError } from "@/api-server/ai/provider";

export class OpenAiProvider extends OpenAiCompatibleProvider {
    constructor(options: {
        apiKey: string;
        baseUrl: string;
        defaultModel: string;
    }) {
        if (!options.baseUrl) {
            throw new AiNotConfiguredError(
                "לא הוגדרה כתובת לשירות ה-AI (OPENAI_BASE_URL)",
            );
        }
        super({
            name: "openai",
            apiKey: options.apiKey,
            missingKeyMessage: "לא הוגדר מפתח API לשירות ה-AI (OPENAI_API_KEY)",
            baseUrl: options.baseUrl,
            defaultModel: options.defaultModel,
        });
    }
}
