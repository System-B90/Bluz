// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discoverModels, resetModelCache, resolveChatModel } from "@/api-server/ai/models";
import { OpenAiProvider } from "@/api-server/ai/openai";
import { AiProvider } from "@/api-server/ai/provider";
import { isModelListed, parseModelList } from "@/api-shared/types/ai-models";
import { aiModelHelper } from "@/components/settings-dialog/tabs/PersonalSettings";

/** #779: model discovery for OpenAI-compatible backends (incl. Open WebUI). */

const fakeProvider = (list: () => Promise<Array<{ id: string }>>, defaultModel = "kimi"): AiProvider => ({
    name: "fake",
    defaultModel,
    chat: vi.fn(),
    streamChat: vi.fn(),
    listModels: vi.fn(list),
}) as unknown as AiProvider;

describe("parseModelList", () => {
    it("reads the OpenAI envelope", () => {
        expect(parseModelList({ object: "list", data: [ { id: "b" }, { id: "a" } ] })).toEqual([ { id: "a" }, { id: "b" } ]);
    });

    it("keeps Open WebUI display names", () => {
        expect(parseModelList({ data: [ { id: "kimi-k2", name: "Kimi K2" } ] })).toEqual([ { id: "kimi-k2", name: "Kimi K2" } ]);
    });

    it("accepts bare arrays and string entries, drops junk and duplicates", () => {
        expect(parseModelList([ "x", { id: "x" }, { id: "" }, { nope: 1 }, 5 ])).toEqual([ { id: "x" } ]);
    });

    it("yields nothing for unknown shapes", () => {
        expect(parseModelList({ error: "nope" })).toEqual([]);
        expect(parseModelList(null)).toEqual([]);
    });

    it("an empty list never flags a model as missing", () => {
        expect(isModelListed("anything", [])).toBe(true);
        expect(isModelListed("a", [ { id: "b" } ])).toBe(false);
    });
});

describe("OpenAiProvider.listModels", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("GETs {base}/models with the bearer key — Open WebUI's /api/models when the base is /api", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [ { id: "m1" } ] }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const provider = new OpenAiProvider({ apiKey: "k", baseUrl: "https://webui.lan/api/", defaultModel: "m1" });

        expect(await provider.listModels()).toEqual([ { id: "m1" } ]);
        const [ url, init ] = fetchMock.mock.calls[ 0 ] as unknown as [string, RequestInit];
        expect(url).toBe("https://webui.lan/api/models");
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    });

    it("turns a non-2xx into a provider error", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
        const provider = new OpenAiProvider({ apiKey: "k", baseUrl: "https://x/v1", defaultModel: "m" });
        await expect(provider.listModels()).rejects.toThrow("401");
    });
});

describe("discoverModels", () => {
    it("caches a listing for a few minutes", async () => {
        const provider = fakeProvider(async () => [ { id: "a" } ]);
        await discoverModels(provider, 0);
        await discoverModels(provider, 60_000);
        expect(provider.listModels).toHaveBeenCalledTimes(1);
        await discoverModels(provider, 10 * 60_000);
        expect(provider.listModels).toHaveBeenCalledTimes(2);
    });

    it("reports failures as an empty list with the reason", async () => {
        const result = await discoverModels(fakeProvider(async () => { throw new Error("TLS"); }));
        expect(result).toEqual({ defaultModel: "kimi", models: [], error: "TLS" });
    });

    it("a provider without listing says so", async () => {
        const provider = { name: "x", defaultModel: "d" } as unknown as AiProvider;
        expect((await discoverModels(provider)).error).toBeTruthy();
    });
});

describe("resolveChatModel — never trust an arbitrary slug on the server's key", () => {
    let provider: AiProvider;
    beforeEach(() => {
        provider = fakeProvider(async () => [ { id: "kimi" }, { id: "qwen" } ]);
        resetModelCache(provider);
    });

    it("empty, missing or default means the server default", async () => {
        expect(await resolveChatModel(provider, "", false)).toBeUndefined();
        expect(await resolveChatModel(provider, undefined, false)).toBeUndefined();
        expect(await resolveChatModel(provider, "kimi", false)).toBeUndefined();
    });

    it("honours a model the server's backend lists", async () => {
        expect(await resolveChatModel(provider, " qwen ", false)).toBe("qwen");
    });

    it("ignores an unlisted model on the server's key", async () => {
        expect(await resolveChatModel(provider, "gpt-expensive", false)).toBeUndefined();
    });

    it("trusts the user's choice on their own key without listing", async () => {
        expect(await resolveChatModel(provider, "anything", true)).toBe("anything");
        expect(provider.listModels).not.toHaveBeenCalled();
    });
});

describe("aiModelHelper", () => {
    const list = { defaultModel: "kimi", models: [ { id: "kimi" }, { id: "qwen" } ] };

    it("names the default when empty", () => {
        expect(aiModelHelper("", list, false)).toContain("kimi");
    });

    it("warns that an unlisted model falls back on the server key", () => {
        expect(aiModelHelper("typo", list, false)).toContain("ברירת המחדל");
        expect(aiModelHelper("typo", list, true)).toContain("ודא שהשם מדויק");
    });

    it("explains a failed listing", () => {
        expect(aiModelHelper("x", { defaultModel: "kimi", models: [], error: "TLS" }, false)).toContain("TLS");
    });
});