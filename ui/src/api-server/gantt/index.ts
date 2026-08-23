import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";

import * as schema from "@/api-server/gantt/schema";

function readIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function createPostgresClient(): Sql {
    const connectionString = process.env.DATABASE_URL;
    const options = {
        // Per-process pool ceiling. With N horizontally scaled app instances the
        // effective ceiling is N * max — size it against Postgres max_connections,
        // or point DATABASE_URL at PgBouncer and set POSTGRES_PREPARE=false.
        max: readIntEnv("POSTGRES_POOL_MAX", 10),
        idle_timeout: readIntEnv("POSTGRES_IDLE_TIMEOUT_S", 30),
        connect_timeout: readIntEnv("POSTGRES_CONNECT_TIMEOUT_S", 10),
        // Named prepared statements are incompatible with transaction-mode
        // poolers (PgBouncer/RDS Proxy). Disable via env when running behind one.
        prepare: process.env.POSTGRES_PREPARE !== "false",
    };
    // postgres-js connects lazily, so a missing DATABASE_URL (unit tests, build
    // steps) only fails if a query is actually issued.
    return connectionString
        ? postgres(connectionString, options)
        : postgres(options);
}

// Next.js dev hot-reload re-evaluates server modules; without this cache every
// reload would open a fresh pool and leak connections until the process dies.
const globalCache = globalThis as unknown as {
    __bluzPostgresDb?: PostgresJsDatabase<typeof schema>;
};

/**
 * Anything that can run gantt queries: the pool itself, or a transaction
 * handle. Helpers accept one so a caller can compose several writes into a
 * single atomic unit instead of each helper opening its own (#518).
 */
export type GanttDbExecutor =
    | Parameters<
          Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]
      >[0]
    | PostgresJsDatabase<typeof schema>;

export const postgresDb: PostgresJsDatabase<typeof schema> =
    globalCache.__bluzPostgresDb ?? drizzle(createPostgresClient(), { schema });

if (process.env.NODE_ENV !== "production") {
    globalCache.__bluzPostgresDb = postgresDb;
}
