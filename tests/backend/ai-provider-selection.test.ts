import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Unit tests for provider selection (`AI_PROVIDER` + the per-user key
 * override): which backend `getAiProvider`/`isAiConfigured` pick, and that a
 * personal key is honored by whichever provider is actually configured — not
 * hardcoded to one backend regardless of `AI_PROVIDER`.
 */

import { getAiProvider, isAiConfigured, resetAiProvider } from "@/api-server/ai";
import { AiNotConfiguredError } from "@/api-server/ai/provider";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    resetAiProvider();
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAiProvider();
});

describe("provider selection", () => {
    it("defaults to openrouter", () => {
        delete process.env.AI_PROVIDER;
        process.env.OPENROUTER_API_KEY = "sk-or-server";
        expect(isAiConfigured()).toBe(true);
        expect(getAiProvider().name).toBe("openrouter");
    });

    it("reports openrouter unconfigured with no server key and no override", () => {
        delete process.env.AI_PROVIDER;
        delete process.env.OPENROUTER_API_KEY;
        expect(isAiConfigured()).toBe(false);
    });

    it("a personal key alone satisfies openrouter with no server key", () => {
        delete process.env.AI_PROVIDER;
        delete process.env.OPENROUTER_API_KEY;
        expect(isAiConfigured("sk-or-personal")).toBe(true);
        expect(getAiProvider("sk-or-personal").name).toBe("openrouter");
    });

    it("switches to the openai-compatible provider via AI_PROVIDER", () => {
        process.env.AI_PROVIDER = "openai";
        process.env.OPENAI_BASE_URL = "https://kimi.internal/openai/v2";
        process.env.OPENAI_API_KEY = "server-key";
        process.env.AI_MODEL = "kimi-latest";

        expect(isAiConfigured()).toBe(true);
        const provider = getAiProvider();
        expect(provider.name).toBe("openai");
        expect(provider.defaultModel).toBe("kimi-latest");
    });

    it("requires OPENAI_BASE_URL for the openai provider — an airgapped gateway has no public default", () => {
        process.env.AI_PROVIDER = "openai";
        delete process.env.OPENAI_BASE_URL;
        process.env.OPENAI_API_KEY = "server-key";

        expect(isAiConfigured()).toBe(false);
        expect(() => getAiProvider()).toThrow(AiNotConfiguredError);
    });

    it("routes a personal key to whichever provider AI_PROVIDER names, not always openrouter (regression)", () => {
        process.env.AI_PROVIDER = "openai";
        process.env.OPENAI_BASE_URL = "https://kimi.internal/openai/v2";
        delete process.env.OPENAI_API_KEY;

        expect(isAiConfigured("user-issued-key")).toBe(true);
        expect(getAiProvider("user-issued-key").name).toBe("openai");
    });

    it("rejects an unknown AI_PROVIDER", () => {
        process.env.AI_PROVIDER = "not-a-real-provider";
        expect(isAiConfigured()).toBe(false);
        expect(() => getAiProvider()).toThrow(AiNotConfiguredError);
    });
});
