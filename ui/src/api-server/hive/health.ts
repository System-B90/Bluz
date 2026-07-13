const NEXT_PUBLIC_HIVE_URL = process.env.NEXT_PUBLIC_HIVE_URL ?? "";
const HIVE_HEALTH_TIMEOUT_MS = 3000;

export async function isHiveReachable(): Promise<boolean> {
    try {
        const response = await fetch(
            `${NEXT_PUBLIC_HIVE_URL.replace(/\/$/, "")}/api/core/sso/.well-known/openid-configuration`,
            { signal: AbortSignal.timeout(HIVE_HEALTH_TIMEOUT_MS) },
        );
        return response.ok;
    } catch {
        return false;
    }
}
