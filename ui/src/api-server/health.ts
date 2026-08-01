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
    try {
        await Promise.race([
            probe(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error("health check timed out")),
                    CHECK_TIMEOUT_MS,
                ),
            ),
        ]);
        return true;
    } catch {
        return false;
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
