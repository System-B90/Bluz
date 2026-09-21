/**
 * AES-256-GCM at-rest encryption for small user-supplied secrets (e.g. a
 * personal AI API key) stored in Mongo.
 *
 * The key is derived (SHA-256) from `NEXTAUTH_SECRET` rather than the user's
 * login password: password auth here goes through NextAuth/Hive SSO, so the
 * plaintext password is never available to a settings route to key off of.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error("NEXTAUTH_SECRET is not configured; cannot encrypt secrets at rest");
    }
    return createHash("sha256").update(secret).digest();
}

/** Encrypts `plaintext`. Returns "" for "" — nothing to protect. */
export function encryptSecret(plaintext: string): string {
    if (!plaintext) return "";
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypts a value produced by {@link encryptSecret}. A value without the
 * `enc:v1:` prefix is returned unchanged — covers "" and any row written
 * before encryption was introduced.
 */
export function decryptSecret(stored: string): string {
    if (!stored.startsWith(PREFIX)) return stored;
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = raw.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
