import { sql } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { isHiveReachable } from "@/api-server/hive/health";
import { databaseController } from "@/api-server/mongo-db-controller";

/** Per-check budget. Kept under the container healthcheck timeout. */
const CHECK_TIMEOUT_MS = 2500;

export type DependencyStatus = "degraded" | "down" | "up";

export type HealthReport = {
    status: "degraded" | "healthy" | "unhealthy";
    checks: Record<string, DependencyStatus>;
};

/**
 * A hung dependency must not hang the healthcheck itself, otherwise Docker's
 * own timeout is the only bound and the container reports "starting" forever.
 */
async function withTimeout(probe: () => Promise<void>): Promise<boolean> {
    // The probe's own rejection must be swallowed here, not just at the race:
    // when the timeout wins, the probe is still running, and its later
    // rejection has no handler left. Node's default for an unhandled rejection
    // is to throw, which killed the whole server — the container crash-looped
    // every time a database was briefly slow, which is exactly when the
    // healthcheck matters.
    let timer: NodeJS.Timeout | undefined;
    const settled = probe().catch(() => {
        throw new Error("health check failed");
    });

    try {
        await Promise.race([
            settled,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("health check timed out")),
                    CHECK_TIMEOUT_MS,
                );
            }),
        ]);
        return true;
    } catch {
        return false;
    } finally {
        // Without this the process stays awake for the full timeout on every
        // successful check.
        clearTimeout(timer);
    }
}

const checkMongo = () =>
    withTimeout(async () => {
        await databaseController.client.db("admin").command({ ping: 1 });
    });

const checkPostgres = () =>
    withTimeout(async () => {
        await postgresDb.execute(sql`select 1`);
    });

/**
 * Hive is an external service Bluz degrades around rather than depends on
 * (see the fallback in the post-auth layout), so its being down must stay
 * distinguishable from Bluz itself being down — it never yields "unhealthy".
 */
export async function getHealthReport(): Promise<HealthReport> {
    const [mongo, postgres, hive] = await Promise.all([
        checkMongo(),
        checkPostgres(),
        isHiveReachable(),
    ]);

    const status = !mongo || !postgres ? "unhealthy" : hive ? "healthy" : "degraded";

    return {
        status,
        checks: {
            mongodb: mongo ? "up" : "down",
            postgres: postgres ? "up" : "down",
            hive: hive ? "up" : "degraded",
        },
    };
}
