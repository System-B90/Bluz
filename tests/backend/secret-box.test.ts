import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openSecret, sealSecret } from "@/api-server/secret-box";

/**
 * Unit tests for the AES-256-GCM sealing of secrets persisted in Mongo
 * (Google OAuth tokens among them). What matters here: round-trip fidelity,
 * the documented wire format, tamper detection, and that a missing or
 * wrong-sized SYM_ENC_KEY fails loudly instead of silently weakening.
 */

// 32 bytes as hex — exactly what scripts/setup.py provisions into SYM_ENC_KEY.
const TEST_KEY = "ab".repeat(32);

beforeEach(() => {
    vi.stubEnv("SYM_ENC_KEY", TEST_KEY);
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("seal/open round trip", () => {
    it("recovers the original plaintext", () => {
        const sealed = sealSecret("ya29.access-token-value");
        expect(openSecret(sealed)).toBe("ya29.access-token-value");
    });

    it("round-trips Hebrew text", () => {
        expect(openSecret(sealSecret("סוד בעברית"))).toBe("סוד בעברית");
    });
});

describe("wire format", () => {
    it("emits v1:<iv b64>:<authTag b64>:<ciphertext b64>", () => {
        const sealed = sealSecret("payload");
        const parts = sealed.split(":");

        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe("v1");
        // 12-byte GCM IV, 16-byte auth tag, and a ciphertext the same size as
        // the plaintext (GCM is a stream mode) that decrypts back to it.
        expect(Buffer.from(parts[1], "base64")).toHaveLength(12);
        expect(Buffer.from(parts[2], "base64")).toHaveLength(16);
        expect(Buffer.from(parts[3], "base64")).toHaveLength(
            Buffer.byteLength("payload", "utf8"),
        );
        expect(openSecret(sealed)).toBe("payload");
    });

    it("seals with a fresh IV every time", () => {
        expect(sealSecret("same input")).not.toBe(sealSecret("same input"));
    });
});

describe("tamper detection", () => {
    it("rejects a flipped ciphertext", () => {
        const [prefix, iv, authTag] = sealSecret("top secret").split(":");
        const tampered = [
            prefix,
            iv,
            authTag,
            Buffer.from("tampered payload", "utf8").toString("base64"),
        ].join(":");

        expect(() => openSecret(tampered)).toThrow();
    });

    it("rejects a forged auth tag", () => {
        const [prefix, iv, , ciphertext] = sealSecret("top secret").split(":");
        const forged = [
            prefix,
            iv,
            Buffer.alloc(16, 0).toString("base64"),
            ciphertext,
        ].join(":");

        expect(() => openSecret(forged)).toThrow();
    });

    it("fails under a different key", () => {
        const sealed = sealSecret("top secret");
        vi.stubEnv("SYM_ENC_KEY", "cd".repeat(32));

        expect(() => openSecret(sealed)).toThrow();
    });
});

describe("malformed sealed values", () => {
    it.each([
        ["", "empty string"],
        ["not-sealed-at-all", "no colons"],
        ["v9:aGVsbG8=:dGFn:Y2lwaGVy", "unknown prefix"],
        ["v1:dGFn:Y2lwaGVy", "missing parts"],
    ])("rejects %s (%s)", (sealed) => {
        expect(() => openSecret(sealed)).toThrowError(
            "Malformed sealed secret.",
        );
    });
});

describe("SYM_ENC_KEY validation", () => {
    it("raises a clear error when the key is not set", () => {
        delete process.env.SYM_ENC_KEY;

        expect(() => sealSecret("x")).toThrowError(
            "SYM_ENC_KEY environment variable has not been set!",
        );
        expect(() => openSecret("v1:a:b:c")).toThrowError(
            "SYM_ENC_KEY environment variable has not been set!",
        );
    });

    it("raises a clear error when the key is the wrong length", () => {
        vi.stubEnv("SYM_ENC_KEY", "abcd"); // 2 bytes, not 32

        expect(() => sealSecret("x")).toThrowError(
            "SYM_ENC_KEY must be 32 bytes of hex (64 hex chars).",
        );
    });
});
