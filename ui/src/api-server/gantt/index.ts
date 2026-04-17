import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/api-server/gantt/schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const postgresDb = drizzle(client, { schema });
