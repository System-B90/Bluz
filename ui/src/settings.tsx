// eslint-disable-next-line no-restricted-imports -- Barrel re-export boundary: this file is the allowed import path for session-common
export * from "../../session-server/session-common";

const SECONDS_IN_AN_HOUR = 3600;
const HOURS_IN_A_DAY = 24;
const SECONDS_IN_A_DAY = SECONDS_IN_AN_HOUR * HOURS_IN_A_DAY;
const DAYS_IN_A_WEEK = 7;
const MILLISECONDS_IN_A_SECOND = 1000;

/** Milliseconds per day, for turning a timestamp delta into whole days. */
export const MILLISECONDS_IN_A_DAY =
    SECONDS_IN_A_DAY * MILLISECONDS_IN_A_SECOND;

/**
 * Widest date range a single event query may ask for. A leap year, so a
 * legitimate "one full year" export is never rejected, while an unbounded
 * range that would turn one request into a full scan still is.
 */
export const MAX_EVENT_RANGE_DAYS = 366;

export const USER_AUTH_COOKIE_NAME = "auth";
// HTTP Caching
export const CACHE_CONTROL_HTTP_HEADER = "Cache-Control";
export const IMMUTABLE_CACHE_MAX_TTL = SECONDS_IN_A_DAY * DAYS_IN_A_WEEK * 4; // 28 days
/**
 * A past iteration's Hive data is frozen — its Hive instance is gone or its ids
 * have been reused, so the response is served from the snapshot taken at
 * creation. Cache it for a week; a manual "sync Hive info" is the only thing
 * that can change it, and that only applies to the current iteration.
 */
export const ARCHIVED_HIVE_CACHE_TTL = SECONDS_IN_A_DAY * DAYS_IN_A_WEEK; // 7 days

export function getJwtSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET environment variable has not been set!");
    }
    return jwtSecret;
}

let _encryptionKey: CryptoKey | null = null;
export async function getSymetricalEncyptionKey() {
    if (null === _encryptionKey) {
        const symEncKey = process.env.SYM_ENC_KEY;
        if (!symEncKey) {
            throw new Error(
                "SYM_ENC_KEY environment variable has not been set!",
            );
        }
        _encryptionKey = await crypto.subtle.importKey(
            "raw",
            Buffer.from(symEncKey, "base64"),
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"],
        );
    }
    return _encryptionKey;
}
