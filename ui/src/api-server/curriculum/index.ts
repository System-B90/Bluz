import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string from your .env file
const connectionString = process.env.DATABASE_URL!;

// Initialize the postgres client
const client = postgres(connectionString);

// Initialize Drizzle with your schema
// Passing the schema here is REQUIRED for Relational Queries to work
export const postgresDb = drizzle(client, { schema });
