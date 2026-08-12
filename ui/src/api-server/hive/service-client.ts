import { HiveClient } from "@/api-server/hive/client";
import { HiveClientError } from "@/api-shared/errors";

/*
 * Hive access for work that runs without a logged-in user.
 *
 * Every other Hive call in Bluz borrows the browsing user's SSO tokens. The
 * lesson activator runs on a timer — at 08:00 nobody is holding a session, so
 * it authenticates as a dedicated Hive account (HIVE_API_USERNAME /
 * HIVE_API_PASSWORD) through Hive's plain JWT endpoint.
 *
 * The equivalent helper now lives in `@system-b90/hive-core` (service-auth);
 * this local copy goes away when Bluz upgrades to that release.
 */

const TOKEN_ENDPOINT = "/api/core/token/";

/**
 * How long a client is reused before logging in again.
 *
 * Pinned to Hive's own access-token lifetime (`SIMPLE_JWT
 * .ACCESS_TOKEN_LIFETIME`, 60 minutes by default, same env var), minus a
 * minute so a request never leaves with a token that expires in flight. The
 * client still refreshes on a 401, so this is the planned path rather than
 * the only one; caching is what keeps the activator from asking Hive for a
 * token before every call.
 */
const ACCESS_TOKEN_LIFETIME_MS =
    (Number(process.env.HIVE_ACCESS_TOKEN_LIFETIME_MINUTES) || 60) * 60 * 1000;
const CLIENT_TTL_MS = Math.max(ACCESS_TOKEN_LIFETIME_MS - 60_000, 60_000);

type CachedClient = { client: HiveClient; hiveUrl: string; obtainedAt: number };

// One cached client per process. Rebuilt on expiry rather than refreshed:
// re-obtaining is a single request and keeps this free of refresh-token state.
let cached: CachedClient | undefined;

/** True when service credentials are configured at all. */
export function hasHiveServiceCredentials(): boolean {
    return Boolean(process.env.HIVE_API_USERNAME && process.env.HIVE_API_PASSWORD);
}

/**
 * A Hive client authenticated as the Bluz service account.
 *
 * @param hiveUrl Hive instance to target; defaults to `NEXT_PUBLIC_HIVE_URL`.
 * @returns A client acting as the service account.
 * @throws HiveClientError when credentials are missing or Hive rejects them.
 * @example
 * ```typescript
 * const hive = await createHiveServiceClient();
 * await hive.setLessonForClass(classId, lessonId);
 * ```
 */
export async function createHiveServiceClient(
    hiveUrl?: string,
): Promise<HiveClient> {
    const baseUrl = hiveUrl ?? process.env.NEXT_PUBLIC_HIVE_URL ?? "";

    if (
        cached &&
        cached.hiveUrl === baseUrl &&
        Date.now() - cached.obtainedAt < CLIENT_TTL_MS
    ) {
        return cached.client;
    }

    const username = process.env.HIVE_API_USERNAME;
    const password = process.env.HIVE_API_PASSWORD;
    if (!username || !password) {
        throw new HiveClientError(
            "לא הוגדרו פרטי משתמש שירות להייב (HIVE_API_USERNAME / HIVE_API_PASSWORD)",
        );
    }

    const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}${TOKEN_ENDPOINT}`,
        {
            body: JSON.stringify({ password, username }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
        },
    );

    if (!response.ok) {
        throw new HiveClientError(
            `התחברות משתמש השירות להייב נכשלה (${response.status})`,
        );
    }

    const data = await response.json();
    if (!data?.access) {
        throw new HiveClientError("הייב לא החזיר טוקן למשתמש השירות");
    }

    const client = new HiveClient(data.access, data.refresh, baseUrl);
    cached = { client, hiveUrl: baseUrl, obtainedAt: Date.now() };
    return client;
}

/** Drops the cached client. Exists for tests and for forcing a re-login. */
export function resetHiveServiceClient(): void {
    cached = undefined;
}
