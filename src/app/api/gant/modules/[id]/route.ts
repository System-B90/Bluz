export const dynamic = 'force-dynamic';

import { DbModule } from "@/api-server/curriculum/db-module";
import { buildGantItemRoutes } from "@/app/api/gant/base";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbModule });
export { GET, PATCH, DELETE };
