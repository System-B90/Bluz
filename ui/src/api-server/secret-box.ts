import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM sealing for secrets persisted in the database (e.g. OAuth
 * tokens). Keyed by SYM_ENC_KEY (32-byte hex, provisioned by scripts/setup.py).
 *
 * Wire format: "v1:<iv b64>:<authTag b64>:<ciphertext b64>".
 */

const SEAL_PREFIX = "v1";
const IV_LENGTH = 12;

function getKey(): Buffer {
    const hex = process.env.SYM_ENC_KEY;
    if (!hex) {
        throw new Error("SYM_ENC_KEY environment variable has not been set!");
    }
    const key = Buffer.from(hex, "hex");
    if (key.length !== 32) {
        throw new Error("SYM_ENC_KEY must be 32 bytes of hex (64 hex chars).");
    }
    return key;
}

export function sealSecret(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    return [
        SEAL_PREFIX,
        iv.toString("base64"),
        cipher.getAuthTag().toString("base64"),
        ciphertext.toString("base64"),
    ].join(":");
}

export function openSecret(sealed: string): string {
    const [prefix, iv, authTag, ciphertext] = sealed.split(":");
    if (prefix !== SEAL_PREFIX || !iv || !authTag || !ciphertext) {
        throw new Error("Malformed sealed secret.");
    }
    const decipher = createDecipheriv(
        "aes-256-gcm",
        getKey(),
        Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
    ]).toString("utf8");
}
