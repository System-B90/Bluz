/**
 * TLS for internal AI gateways (#780).
 *
 * An Open WebUI on another internal network usually carries a certificate from
 * a private CA, so `fetch` refuses it and the user only saw the generic
 * "cannot connect" error. Turning validation off is not an option (#200).
 * Instead:
 *  - `AI_CA_CERT_PATH` adds a CA bundle to the AI client only, on top of the
 *    system roots (nothing else in the process trusts it);
 *  - `NODE_EXTRA_CA_CERTS` still works process-wide, as before;
 *  - a trust failure is reported as such, naming both knobs.
 */

import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";

import { Agent, fetch as undiciFetch } from "undici";

/** Node/OpenSSL codes meaning "the peer's certificate is not trusted". */
const TLS_TRUST_CODES = new Set([
    "CERT_HAS_EXPIRED",
    "CERT_NOT_YET_VALID",
    "CERT_UNTRUSTED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/**
 * The TLS trust code behind a failed fetch, if that is what it was. `fetch`
 * wraps the socket error in `TypeError: fetch failed` with the real one in
 * `cause` (sometimes nested), so the whole chain is walked.
 */
export function tlsTrustErrorCode(error: unknown): null | string {
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth++) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === "string" && TLS_TRUST_CODES.has(code)) return code;
        current = (current as { cause?: unknown }).cause;
    }
    return null;
}

/** Hebrew, actionable: what failed and the two ways to fix it. */
export function tlsTrustMessage(code: string): string {
    return `תעודת ה-TLS של שירות ה-AI אינה מהימנה (${code}). `
        + "אם השער משתמש ב-CA פנימי, הגדירו AI_CA_CERT_PATH (לעוזר ה-AI בלבד) "
        + "או NODE_EXTRA_CA_CERTS (לכל השרת) לקובץ ה-CA בתוך הקונטיינר.";
}

/**
 * The connect-failure message for the AI client: TLS-specific when the cause
 * is an untrusted certificate, the generic one otherwise.
 */
export function aiConnectErrorMessage(error: unknown): string {
    const code = tlsTrustErrorCode(error);
    if (code) return tlsTrustMessage(code);
    return `לא ניתן להתחבר לשירות ה-AI: ${error instanceof Error ? error.message : String(error)}`;
}

let cached: { path: string; agent: Agent } | undefined;

/**
 * An undici agent trusting the system roots plus `AI_CA_CERT_PATH`, or null
 * when the variable is unset. Built once per path.
 * @throws When the file cannot be read: a set-but-broken CA path is a
 * misconfiguration worth failing loudly on, not silently ignoring.
 */
export function aiCaAgent(path = process.env.AI_CA_CERT_PATH): Agent | null {
    if (!path) return null;
    if (cached?.path === path) return cached.agent;
    const extra = readFileSync(path, "utf8");
    const agent = new Agent({ connect: { ca: [ ...rootCertificates, extra ] } });
    cached = { path, agent };
    return agent;
}

/**
 * `fetch` for AI backends: the global one, or undici's with the CA agent when
 * `AI_CA_CERT_PATH` is set (global fetch cannot take a per-call CA).
 */
export const aiFetch: typeof fetch = (input, init) => {
    const agent = aiCaAgent();
    if (!agent) return fetch(input, init);
    return undiciFetch(input as never, { ...(init as object), dispatcher: agent } as never) as unknown as Promise<Response>;
};
