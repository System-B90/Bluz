import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { logger } from "@/logging/pino";

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    const db = drizzle(client);

    logger.info("Running migrations...");

    // The path is relative to where the script is executed in the Docker container
    await migrate(db, { migrationsFolder: "./drizzle" });

    logger.info("Migrations complete!");
    await client.end();
}

runMigrations().catch((err) => {
    logger.error({ err: err }, "Migration failed!");
    process.exit(1);
});
