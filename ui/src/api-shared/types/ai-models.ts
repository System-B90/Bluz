/**
 * Model discovery for OpenAI-compatible backends (#779).
 *
 * `AI_MODEL` used to be a string an operator had to type exactly; a typo only
 * surfaced as a 404 at chat time. The backend's own model list now feeds the
 * personal-settings dropdown and the self-test's "is AI_MODEL real" check.
 */

export type AiModelInfo = {
    /** The slug sent as `model` in chat requests. */
    id: string;
    /** Display name, when the backend reports one (Open WebUI does). */
    name?: string;
};

export type ApiAiModelsResponse = {
    /** Empty when the backend cannot list models; the UI falls back to free text. */
    models: Array<AiModelInfo>;
    /** The server's configured `AI_MODEL`. */
    defaultModel: string;
    /** Why the list is empty, when listing failed. */
    error?: string;
};

/**
 * Normalises a `/models` response. OpenAI and most gateways answer
 * `{ data: [{ id }] }`; Open WebUI's `/api/models` answers the same envelope
 * with a `name` beside each `id`, and some servers return a bare array.
 * @param body The parsed JSON body.
 * @returns De-duplicated models, sorted by id; unknown shapes yield none.
 */
export function parseModelList(body: unknown): Array<AiModelInfo> {
    const raw = Array.isArray(body)
        ? body
        : Array.isArray((body as { data?: unknown })?.data)
            ? (body as { data: Array<unknown> }).data
            : Array.isArray((body as { models?: unknown })?.models)
                ? (body as { models: Array<unknown> }).models
                : [];
    const byId = new Map<string, AiModelInfo>();
    for (const entry of raw) {
        const id = typeof entry === "string"
            ? entry
            : (entry as { id?: unknown })?.id;
        if (typeof id !== "string" || !id.trim()) continue;
        const name = (entry as { name?: unknown })?.name;
        byId.set(id, typeof name === "string" && name && name !== id ? { id, name } : { id });
    }
    return [ ...byId.values() ].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Whether a configured model slug is among the listed ones. An empty list
 * means "unknown", not "absent", so it never triggers a warning.
 */
export function isModelListed(model: string, models: Array<AiModelInfo>): boolean {
    return models.length === 0 || models.some((m) => m.id === model);
}
