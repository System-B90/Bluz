export const dynamic = 'force-dynamic';

import { DbModule } from "@/api-server/gantt/db-module";
import { buildGantItemRoutes } from "@/app/api/gant/base-item";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbModule });
export { DELETE, GET, PATCH };
