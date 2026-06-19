import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    const db = drizzle(client);

    console.log("Running migrations...");

    // The path is relative to where the script is executed in the Docker container
    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("Migrations complete!");
    await client.end();
}

runMigrations().catch((err) => {
    console.error("Migration failed!", err);
    process.exit(1);
});
