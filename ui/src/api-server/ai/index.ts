/**
 * Provider selection. The one place in the codebase that knows which model
 * backend is wired up — everything else takes an {@link AiProvider}.
 *
 * Switching backends: add an entry to `PROVIDERS` and set `AI_PROVIDER`.
 */

import { OpenAiProvider } from "@/api-server/ai/openai";
import { OpenRouterProvider } from "@/api-server/ai/openrouter";
import { AiNotConfiguredError, AiProvider } from "@/api-server/ai/provider";

export * from "@/api-server/ai/provider";

type ProviderDef = {
    /** @param apiKeyOverride A user's own key, used instead of the server's. */
    create: (apiKeyOverride?: string) => AiProvider;
    /** Whether this provider has enough config to serve a request at all. */
    isConfigured: (apiKeyOverride?: string) => boolean;
};

const PROVIDERS: Record<string, ProviderDef> = {
    openrouter: {
        create: (apiKeyOverride) =>
            new OpenRouterProvider({
                apiKey: apiKeyOverride || process.env.OPENROUTER_API_KEY || "",
                baseUrl: process.env.AI_BASE_URL,
                defaultModel: process.env.AI_MODEL,
                referer: process.env.NEXTAUTH_URL,
                title: "Bluz",
            }),
        isConfigured: (apiKeyOverride) =>
            Boolean(apiKeyOverride || process.env.OPENROUTER_API_KEY),
    },
    // A directly reachable OpenAI-compatible endpoint: the real
    // api.openai.com, or (what this was added for) a self-hosted, airgapped
    // gateway in front of a model like Kimi that speaks the same
    // "v2" OpenAI-compatible chat-completions API. `OPENAI_BASE_URL` is
    // required — airgapped deployments have no public default to fall back
    // to — so this is never "configured" without it, even with a key.
    openai: {
        create: (apiKeyOverride) =>
            new OpenAiProvider({
                apiKey: apiKeyOverride || process.env.OPENAI_API_KEY || "",
                baseUrl: process.env.OPENAI_BASE_URL || "",
                defaultModel: process.env.AI_MODEL || "",
            }),
        isConfigured: (apiKeyOverride) =>
            Boolean(process.env.OPENAI_BASE_URL) &&
            Boolean(apiKeyOverride || process.env.OPENAI_API_KEY),
    },
};

const DEFAULT_PROVIDER = "openrouter";

// Providers hold only configuration and a keep-alive HTTP agent, so one
// instance per process is reused rather than rebuilt per request. This cache
// only ever holds the server's own (env-configured) provider — a per-user
// key is never shared across requests, so it always builds a fresh instance.
let cached: { key: string; provider: AiProvider } | undefined;

function currentProviderDef(): { key: string; def: ProviderDef } {
    const key = process.env.AI_PROVIDER || DEFAULT_PROVIDER;
    const def = PROVIDERS[key];
    if (!def) {
        throw new AiNotConfiguredError(
            `ספק AI לא מוכר: ${key}. ערכים אפשריים: ${Object.keys(PROVIDERS).join(", ")}`,
        );
    }
    return { key, def };
}

/**
 * @param apiKeyOverride A user's own key (personal settings), used instead of
 * the server's own key when present — for whichever provider `AI_PROVIDER`
 * currently names.
 * @returns The configured provider.
 * @throws AiNotConfiguredError when `AI_PROVIDER` names something unknown, or
 * the selected provider has no credentials.
 */
export function getAiProvider(apiKeyOverride?: string): AiProvider {
    const { key, def } = currentProviderDef();

    if (apiKeyOverride) return def.create(apiKeyOverride);

    if (cached?.key === key) return cached.provider;
    const provider = def.create();
    cached = { key, provider };
    return provider;
}

/** Drops the cached provider. Exists for tests and for config reloads. */
export function resetAiProvider(): void {
    cached = undefined;
}

/**
 * Whether the deployment can serve AI requests at all.
 * @param apiKeyOverride A user's own key, which alone can satisfy this even
 * when the server has no key of its own configured.
 */
export function isAiConfigured(apiKeyOverride?: string): boolean {
    const key = process.env.AI_PROVIDER || DEFAULT_PROVIDER;
    const def = PROVIDERS[key];
    if (!def) return false;
    return def.isConfigured(apiKeyOverride);
}
