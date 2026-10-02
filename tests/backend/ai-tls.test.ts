// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer, Server } from "node:https";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { OpenAiProvider } from "@/api-server/ai/openai";
import { aiCaAgent, aiConnectErrorMessage, tlsTrustErrorCode } from "@/api-server/ai/tls";

/** #780: internal AI gateways behind a private CA. */

describe("TLS trust error detection", () => {
    it("finds the code in fetch's nested cause chain", () => {
        const error = new TypeError("fetch failed", { cause: { code: "SELF_SIGNED_CERT_IN_CHAIN" } });
        expect(tlsTrustErrorCode(error)).toBe("SELF_SIGNED_CERT_IN_CHAIN");
        expect(tlsTrustErrorCode(new Error("x", { cause: new Error("y", { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } }) })))
            .toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    });

    it("ignores non-TLS failures", () => {
        expect(tlsTrustErrorCode(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }))).toBeNull();
        expect(tlsTrustErrorCode(null)).toBeNull();
    });

    it("names both fixes for a trust failure, keeps the generic text otherwise", () => {
        const tls = aiConnectErrorMessage(new TypeError("fetch failed", { cause: { code: "DEPTH_ZERO_SELF_SIGNED_CERT" } }));
        expect(tls).toContain("AI_CA_CERT_PATH");
        expect(tls).toContain("NODE_EXTRA_CA_CERTS");
        expect(aiConnectErrorMessage(new Error("boom"))).toBe("לא ניתן להתחבר לשירות ה-AI: boom");
    });

    it("an unreadable AI_CA_CERT_PATH fails loudly", () => {
        expect(() => aiCaAgent(join(tmpdir(), "does-not-exist.pem"))).toThrow();
    });

    it("no AI_CA_CERT_PATH means no custom agent", () => {
        expect(aiCaAgent("")).toBeNull();
    });
});

function hasOpenssl(): boolean {
    try {
        execFileSync("openssl", [ "version" ], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

describe.skipIf(!hasOpenssl())("a private-CA gateway, end to end over real TLS", () => {
    let server: Server;
    let baseUrl: string;
    let caPath: string;

    beforeAll(async () => {
        const dir = mkdtempSync(join(tmpdir(), "bluz-ai-ca-"));
        const key = join(dir, "key.pem");
        const cert = join(dir, "cert.pem");
        execFileSync("openssl", [
            "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
            "-keyout", key, "-out", cert, "-subj", "/CN=localhost",
            "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
        ], { stdio: "ignore" });
        caPath = cert;
        const { readFileSync } = await import("node:fs");
        server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ data: [ { id: "kimi-k2" } ] }));
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `https://localhost:${(server.address() as AddressInfo).port}/api`;
    });
    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
    afterEach(() => vi.unstubAllEnvs());

    const provider = () => new OpenAiProvider({ apiKey: "k", baseUrl, defaultModel: "kimi-k2" });

    it("without the CA, the error says the certificate is untrusted", async () => {
        vi.stubEnv("AI_CA_CERT_PATH", "");
        await expect(provider().listModels()).rejects.toThrow("אינה מהימנה");
    });

    it("with AI_CA_CERT_PATH, the AI client trusts the gateway", async () => {
        vi.stubEnv("AI_CA_CERT_PATH", caPath);
        expect(await provider().listModels()).toEqual([ { id: "kimi-k2" } ]);
    });

    it("the CA stays scoped to the AI client: plain fetch still refuses", async () => {
        vi.stubEnv("AI_CA_CERT_PATH", caPath);
        await expect(fetch(`${baseUrl}/models`)).rejects.toThrow();
    });
});