/**
 * Provider selection. The one place in the codebase that knows which model
 * backend is wired up — everything else takes an {@link AiProvider}.
 *
 * Switching backends: add a factory to `FACTORIES` and set `AI_PROVIDER`.
 */

import { OpenRouterProvider } from "@/api-server/ai/openrouter";
import { AiNotConfiguredError, AiProvider } from "@/api-server/ai/provider";

export * from "@/api-server/ai/provider";

type ProviderFactory = () => AiProvider;

const FACTORIES: Record<string, ProviderFactory> = {
    openrouter: () =>
        new OpenRouterProvider({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            baseUrl: process.env.AI_BASE_URL,
            defaultModel: process.env.AI_MODEL,
            referer: process.env.NEXTAUTH_URL,
            title: "Bluz",
        }),
};

const DEFAULT_PROVIDER = "openrouter";

// Providers hold only configuration and a keep-alive HTTP agent, so one
// instance per process is reused rather than rebuilt per request.
let cached: { key: string; provider: AiProvider } | undefined;

/**
 * @returns The configured provider.
 * @throws AiNotConfiguredError when `AI_PROVIDER` names something unknown, or
 * the selected provider has no credentials.
 */
export function getAiProvider(): AiProvider {
    const key = process.env.AI_PROVIDER || DEFAULT_PROVIDER;
    if (cached?.key === key) return cached.provider;

    const factory = FACTORIES[key];
    if (!factory) {
        throw new AiNotConfiguredError(
            `ספק AI לא מוכר: ${key}. ערכים אפשריים: ${Object.keys(FACTORIES).join(", ")}`,
        );
    }

    const provider = factory();
    cached = { key, provider };
    return provider;
}

/** Drops the cached provider. Exists for tests and for config reloads. */
export function resetAiProvider(): void {
    cached = undefined;
}

/** Whether the deployment can serve AI requests at all. */
export function isAiConfigured(): boolean {
    const key = process.env.AI_PROVIDER || DEFAULT_PROVIDER;
    if (!FACTORIES[key]) return false;
    return key === "openrouter" ? Boolean(process.env.OPENROUTER_API_KEY) : true;
}
