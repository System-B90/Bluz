export const dynamic = 'force-dynamic';

import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { buildGantItemRoutes } from "@/app/api/gantt/base-item";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbModuleEvent });
export { DELETE, GET, PATCH };
