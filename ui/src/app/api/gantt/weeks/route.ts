export const dynamic = 'force-dynamic';

import { DbWeek } from "@/api-server/gantt/db-week";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbWeek });
export { GET, POST };
