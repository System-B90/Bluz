/**
 * Which model a user's chat runs on (#779).
 *
 * The chat route never trusts a model slug from the request: forwarding it
 * would let any staff session pick (and bill) an arbitrary model on the
 * server's key. A personal model setting is honoured only when it is safe:
 * the user pays with their own key, or the slug is one the server's own
 * backend lists.
 */

import { AiProvider } from "@/api-server/ai/provider";
import { AiModelInfo, ApiAiModelsResponse } from "@/api-shared/types/ai-models";
import { logger } from "@/logging/pino";

const CACHE_MS = 5 * 60_000;
const LIST_TIMEOUT_MS = 5_000;

// Keyed by instance: the server's own provider is a process singleton, so its
// list is fetched once per window. A per-user-key provider is built per
// request and is never asked (its owner's choice is trusted as-is).
const cache = new WeakMap<AiProvider, { at: number; models: Array<AiModelInfo> }>();

/** Drops cached lists. For tests. */
export function resetModelCache(provider: AiProvider): void {
    cache.delete(provider);
}

/**
 * The backend's models, cached for a few minutes.
 * @returns `models` empty plus `error` when the backend cannot list them.
 */
export async function discoverModels(
    provider: AiProvider,
    now = Date.now(),
): Promise<ApiAiModelsResponse> {
    const base = { defaultModel: provider.defaultModel };
    if (!provider.listModels) return { ...base, models: [], error: "הספק אינו תומך ברשימת מודלים" };

    const hit = cache.get(provider);
    if (hit && now - hit.at < CACHE_MS) return { ...base, models: hit.models };

    try {
        const models = await provider.listModels(AbortSignal.timeout(LIST_TIMEOUT_MS));
        cache.set(provider, { at: now, models });
        return { ...base, models };
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.warn({ err: error }, "ai: model listing failed");
        return { ...base, models: [], error };
    }
}

/**
 * The model to send for this user's chat, or undefined for the server default.
 * @param provider The provider the chat will use.
 * @param requested The user's personal model setting ("" = default).
 * @param hasOwnKey The user chats on their own API key.
 */
export async function resolveChatModel(
    provider: AiProvider,
    requested: string | undefined,
    hasOwnKey: boolean,
): Promise<string | undefined> {
    // Settings saved before #779 carry no model at all.
    const model = (requested ?? "").trim();
    if (!model || model === provider.defaultModel) return undefined;
    if (hasOwnKey) return model;

    const { models } = await discoverModels(provider);
    if (models.some((m) => m.id === model)) return model;
    logger.warn({ model }, "ai: personal model not offered by the server's backend; using the default");
    return undefined;
}
