export const dynamic = 'force-dynamic';

import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbModuleEvent });
export { GET, POST };
