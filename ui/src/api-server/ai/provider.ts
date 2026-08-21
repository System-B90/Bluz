/**
 * The seam between Bluz and whichever model backend is in use.
 *
 * The agent loop, route handlers and jobs depend on {@link AiProvider} only. A
 * new backend means one new file implementing this interface plus one line in
 * `./index.ts` — no caller changes.
 */

import { AiChatResult, AiMessage } from "@/api-shared/types/ai";

/**
 * A tool offered to the model. `parameters` is a JSON Schema object; every
 * current backend accepts that shape, so it needs no per-provider translation.
 */
export type AiToolSpec = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
};

/** Normalised request handed to a provider. */
export type AiChatRequest = {
    messages: Array<AiMessage>;
    tools?: Array<AiToolSpec>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** Aborts the upstream call when the browser disconnects. */
    signal?: AbortSignal;
};

/**
 * Provider-level stream frame. Deliberately narrower than the app-level
 * `AiStreamEvent`: a provider knows about text and completions, not about
 * tool approval or Bluz's transcript.
 */
export type AiProviderEvent =
    | { kind: "final"; result: AiChatResult }
    | { kind: "text"; text: string };

export type AiProvider = {
    /** Stable identifier, used in logs and in `AI_PROVIDER`. */
    readonly name: string;
    /** Model used when a request does not name one. */
    readonly defaultModel: string;

    /** One-shot completion, for callers with nothing to stream to. */
    chat: (request: AiChatRequest) => Promise<AiChatResult>;

    /**
     * Incremental completion. Yields text as it arrives and terminates with a
     * single `final` frame carrying tool calls and usage.
     */
    streamChat: (request: AiChatRequest) => AsyncIterable<AiProviderEvent>;
}

/**
 * An upstream model backend failed or refused. Distinct from
 * `ClientApiError`: the caller's request was well-formed, the dependency was
 * not, so this maps to 502 rather than 400.
 */
export class AiProviderError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "AiProviderError";
        this.status = status;
    }
}

/** Raised when the deployment has no usable AI configuration. */
export class AiNotConfiguredError extends AiProviderError {
    constructor(message: string) {
        super(message);
        this.name = "AiNotConfiguredError";
    }
}
