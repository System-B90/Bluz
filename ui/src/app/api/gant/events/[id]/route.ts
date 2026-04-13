export const dynamic = 'force-dynamic';

import { DbModuleEvent } from "@/api-server/curriculum/db-module-event";
import { buildGantItemRoutes } from "@/app/api/gant/base-item";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbModuleEvent });
export { GET, PATCH, DELETE };
